import { describe, expect, it } from "vitest";
import { requireAdmin, sanitizeSearch, toMemberProfile, type ReadClient } from "../access";
import { searchMembers } from "../tools/leden";
import { oauthReturnPath } from "@/lib/oauth-return-path";

function fakeClient(roles: string[], opts: { error?: boolean } = {}) {
  const calls: string[] = [];
  const builder: any = {
    select: () => builder,
    eq: (_c: string, v: string) => { calls.push(`eq:${v}`); return builder; },
    limit: async () => opts.error ? { data: null, error: { message: "x" } } : { data: roles.includes("admin") ? [{ role: "admin" }] : [], error: null },
  };
  return { client: { from: (t: string) => { calls.push(`from:${t}`); return builder; } } as unknown as ReadClient, calls };
}
const ctx = (uid: string | null) => ({ isAuthenticated: () => uid !== null, getUserId: () => uid ?? "" });

describe("MCP admin gate", () => {
  it("allows an authenticated admin", async () => {
    const { client, calls } = fakeClient(["admin"]);
    await expect(requireAdmin(ctx("u1"), client)).resolves.toBe("u1");
    expect(calls).toContain("eq:u1");
  });
  it("rejects anonymous callers without touching the database", async () => {
    const { client, calls } = fakeClient(["admin"]);
    await expect(requireAdmin(ctx(null), client)).rejects.toThrow(/Niet geauthenticeerd/);
    expect(calls).toHaveLength(0);
  });
  it("rejects board-only / ordinary members (no admin role)", async () => {
    await expect(requireAdmin(ctx("u2"), fakeClient(["board"]).client)).rejects.toThrow(/Geen toegang/);
    await expect(requireAdmin(ctx("u3"), fakeClient([]).client)).rejects.toThrow(/Geen toegang/);
  });
  it("fails closed when the role lookup errors", async () => {
    await expect(requireAdmin(ctx("u1"), fakeClient(["admin"], { error: true }).client)).rejects.toThrow(/gecontroleerd/);
  });
});

describe("MCP data minimisation", () => {
  it("never exposes bank, invoice, UBO, private or birthday fields", () => {
    const p = toMemberProfile({ id: 1, member_type: "member", data: {
      naam: "Shop", email: "info@shop.nl", iban: "NL00BANK", factuurEmail: "f@x", telefoon2: "06", email2: "prive@x",
      contacten: [{ naam: "A", email: "a@prive", verjaardag: "1-1" }],
      locaties: [{ naam: "V", adres: "Straat 1", ubo: [{ naam: "Eigenaar" }], vergunninghouder: "P" }],
    } });
    const json = JSON.stringify(p);
    for (const bad of ["NL00BANK", "f@x", "prive", "a@prive", "1-1", "Eigenaar", "vergunninghouder"]) expect(json).not.toContain(bad);
    expect(p.zakelijk_email).toBe("info@shop.nl");
    expect(p.vestigingen[0].adres).toBe("Straat 1");
  });
  it("sanitizes filter syntax out of search terms", () => {
    expect(sanitizeSearch("a,b.or(id.eq.1)%_*")).toBe("a b or id eq 1");
  });
  it("search paginates with bounded range and select-only calls", async () => {
    const used: string[] = [];
    const b: any = new Proxy({}, { get: (_t, k: string) => {
      used.push(k);
      if (k === "range") return async (f: number, t: number) => ({ data: [], error: null, count: 0, f, t });
      if (k === "then") return undefined;
      return () => b;
    } });
    const client = { from: () => b } as unknown as ReadClient;
    await searchMembers(client, { zoekterm: "x", limit: 10, offset: 20 });
    expect(used.some((k) => ["insert", "update", "upsert", "delete", "rpc"].includes(k))).toBe(false);
  });
});

describe("OAuth return path", () => {
  it("keeps consent URL and rejects external redirects", () => {
    expect(oauthReturnPath("/.lovable/oauth/consent?authorization_id=abc")).toBe("/.lovable/oauth/consent?authorization_id=abc");
    expect(oauthReturnPath("//evil.example")).toBe("/");
    expect(oauthReturnPath("/\\evil.example")).toBe("/");
  });
});
