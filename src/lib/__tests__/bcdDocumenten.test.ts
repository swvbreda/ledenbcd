import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  BronFout, DOC_HEADER, deriveDocumentKey, fetchDocumenten, fetchGemeenten, resolveGmCode, sourceOrigin,
} from "../bcdDocumenten";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const doc = (o: Record<string, unknown> = {}) => ({
  id: "d1", titel: "Coffeeshopbeleid 2026", documentdatum: "2026-03-01", documentsoort: "Beleidsregel",
  gemeente: { gm_code: "GM0363", naam: "Amsterdam" }, bron_url: "https://lokaleregelgeving.overheid.nl/x", ...o,
});
const reden = async (p: Promise<unknown>) => { try { await p; return "ok"; } catch (e) { return (e as BronFout).reden; } };

describe("bcdDocumenten", () => {
  it("derived key is HMAC-SHA256(base, 'bcd-public-documents:v1') hex", async () => {
    expect(await deriveDocumentKey("geheim")).toBe(createHmac("sha256", "geheim").update("bcd-public-documents:v1").digest("hex"));
  });

  it("only accepts the fixed https monitor origin", () => {
    expect(sourceOrigin("https://coffeeshopbeleid.com/")).toBe("https://coffeeshopbeleid.com");
    for (const bad of [undefined, "http://coffeeshopbeleid.com", "https://evil.example", "https://u:p@coffeeshopbeleid.com"]) {
      expect(() => sourceOrigin(bad)).toThrow(BronFout);
    }
  });

  it("sends key only in header, never in URL, and refuses redirects", async () => {
    const f = vi.fn(async () => json({ documenten: [doc()], volgende_cursor: null }));
    await fetchDocumenten("https://coffeeshopbeleid.com", "k123", "GM0363", null, 20, f as any);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://coffeeshopbeleid.com/api/public/bcd-documenten/v1/documenten?gm_code=GM0363&limit=20");
    expect(url).not.toContain("k123");
    expect((init.headers as Record<string, string>)[DOC_HEADER]).toBe("k123");
    expect(init.redirect).toBe("error");
  });

  it("caps limit at 50 and rejects bad gm_code/cursor before any request", async () => {
    const f = vi.fn(async () => json({ documenten: [], volgende_cursor: null }));
    await fetchDocumenten("https://coffeeshopbeleid.com", "k", "GM0363", "abc", 999, f as any);
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("limit=50");
    expect(await reden(fetchDocumenten("https://coffeeshopbeleid.com", "k", "0363", null, 20, f as any))).toBe("ongeldige_invoer");
    expect(await reden(fetchDocumenten("https://coffeeshopbeleid.com", "k", "GM0363", "a b&x=1", 20, f as any))).toBe("ongeldige_invoer");
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("strips non-allowlisted fields, drops non-https/other-gemeente records, sorts newest first", async () => {
    const f = async () => json({ volgende_cursor: "c2", documenten: [
      doc({ id: "old", documentdatum: "2020-01-01", analyse: "geheim", score: 9, notities: "x", fulltext: "..." }),
      doc({ id: "nodate", documentdatum: null }),
      doc({ id: "new", documentdatum: "2026-09-01" }),
      doc({ id: "http", bron_url: "http://x.nl/a" }),
      doc({ id: "js", bron_url: "javascript:alert(1)" }),
      doc({ id: "other", gemeente: { gm_code: "GM0599", naam: "Rotterdam" } }),
    ] });
    const r = await fetchDocumenten("https://coffeeshopbeleid.com", "k", "GM0363", null, 20, f as any);
    expect(r.documenten.map((d) => d.id)).toEqual(["new", "old", "nodate"]);
    expect(Object.keys(r.documenten[1]).sort()).toEqual(["bron_url", "documentdatum", "documentsoort", "gemeente", "id", "titel"]);
    expect(r.volgende_cursor).toBe("c2");
  });

  it("incompatible API is an error, never an empty success", async () => {
    const o = "https://coffeeshopbeleid.com";
    expect(await reden(fetchDocumenten(o, "k", "GM0363", null, 20, (async () => json({ items: [] })) as any))).toBe("incompatibel");
    expect(await reden(fetchDocumenten(o, "k", "GM0363", null, 20, (async () => json({ documenten: [{ id: 1 }], volgende_cursor: null })) as any))).toBe("incompatibel");
    expect(await reden(fetchDocumenten(o, "k", "GM0363", null, 20, (async () => new Response("<html>", { headers: { "content-type": "text/html" } })) as any))).toBe("incompatibel");
    expect(await reden(fetchGemeenten(o, "k", (async () => json({ gemeenten: [{ gm_code: "X", naam: "A" }] })) as any))).toBe("incompatibel");
  });

  it("maps 404/5xx/network to unreachable and 401/403 to not configured", async () => {
    const o = "https://coffeeshopbeleid.com";
    expect(await reden(fetchGemeenten(o, "k", (async () => json({}, 404)) as any))).toBe("bron_onbereikbaar");
    expect(await reden(fetchGemeenten(o, "k", (async () => json({}, 502)) as any))).toBe("bron_onbereikbaar");
    expect(await reden(fetchGemeenten(o, "k", (async () => { throw new Error("x"); }) as any))).toBe("bron_onbereikbaar");
    expect(await reden(fetchGemeenten(o, "k", (async () => json({}, 401)) as any))).toBe("niet_geconfigureerd");
  });

  it("resolves gemeente names exactly via the official mapping; ambiguous/unknown -> null", () => {
    const lijst = [
      { gm_code: "GM0479", naam: "Zaanstad" }, { gm_code: "GM0363", naam: "Amsterdam" },
      { gm_code: "GM0001", naam: "Dubbel" }, { gm_code: "GM0002", naam: "dubbel" },
    ];
    expect(resolveGmCode("Zaandam", lijst)?.gm_code).toBe("GM0479");
    expect(resolveGmCode("gemeente amsterdam", lijst)?.gm_code).toBe("GM0363");
    expect(resolveGmCode("Amsterdm", lijst)).toBeNull();
    expect(resolveGmCode("Dubbel", lijst)).toBeNull();
  });
});
