import { describe, expect, it } from "vitest";
import { parseSubjectCodes, runProjectMail, toPlainText, validateExtraction, type MailDb, type MailGraph, type MailMeta } from "@/lib/projectMail";
import { assertGraphUrl } from "@/lib/plannerGraph.server";

describe("onderwerpcodes", () => {
  it("exacte code, case-insensitief", () => expect(parseSubjectCodes("Re: [bcd-worldline] update")).toEqual({ kind: "one", code: "BCD-WORLDLINE" }));
  it("zonder code of met andere blokhaken: niets", () => {
    expect(parseSubjectCodes("Worldline update")).toEqual({ kind: "none" });
    expect(parseSubjectCodes("[EXTERNAL] Worldline")).toEqual({ kind: "none" });
  });
  it("geen fuzzy match op BCD-WORLDLINEX of titel", () => expect(parseSubjectCodes("[BCD-WORLDLINE-X]")).toEqual({ kind: "invalid", tokens: ["BCD-WORLDLINE-X"] }));
  it("meerdere verschillende codes → beoordeling", () => expect(parseSubjectCodes("[BCD-A1B2C3] en [BCD-WORLDLINE]").kind).toBe("multiple"));
  it("zelfde code tweemaal = één", () => expect(parseSubjectCodes("[BCD-ARNHEM] [bcd-arnhem]")).toEqual({ kind: "one", code: "BCD-ARNHEM" }));
});

describe("AI-validatie", () => {
  const body = "Graag het verweerschrift indienen bij de rechtbank. Jan doet de brief vóór 1 december. Taak X is klaar.";
  it("bron moet letterlijk in mail staan; verzonnen taak naar beoordeling", () => {
    const ex = validateExtraction({ taken: [{ titel: "Verzonnen", bronzin: "Dit staat er niet", expliciet: true }] }, body, new Set());
    expect(ex.autoTasks).toHaveLength(0);
    expect(ex.reviewTasks[0].why).toBe("bron_niet_gevonden");
  });
  it("expliciete taak zonder eigenaar/deadline wordt automatisch", () => {
    const ex = validateExtraction({ taken: [{ titel: "Verweerschrift indienen", bronzin: "Graag het verweerschrift indienen bij de rechtbank.", expliciet: true, eigenaar_genoemd: false, deadline_genoemd: false }] }, body, new Set());
    expect(ex.autoTasks.map((t) => t.title)).toEqual(["Verweerschrift indienen"]);
  });
  it("eigenaar of deadline genoemd → nooit automatisch", () => {
    const ex = validateExtraction({ taken: [{ titel: "Brief", bronzin: "Jan doet de brief vóór 1 december.", expliciet: true, eigenaar_genoemd: true, deadline_genoemd: true }] }, body, new Set());
    expect(ex.autoTasks).toHaveLength(0);
    expect(ex.reviewTasks[0].why).toBe("eigenaar_genoemd");
  });
  it("bestaande open taak wordt niet dubbel", () => {
    const ex = validateExtraction({ taken: [{ titel: "Verweerschrift indienen", bronzin: "Graag het verweerschrift indienen bij de rechtbank.", expliciet: true }] }, body, new Set(["verweerschrift indienen"]));
    expect(ex.autoTasks).toHaveLength(0);
    expect(ex.reviewTasks).toHaveLength(0);
  });
  it("status van bestaande taak alleen als beoordeling", () => {
    const ex = validateExtraction({ taakstatus: [{ beschrijving: "Taak X afgerond", bronzin: "Taak X is klaar." }] }, body, new Set());
    expect(ex.statusNotes).toHaveLength(1);
  });
  it("HTML is data: scripts weg", () => expect(toPlainText("<script>alert(1)</script><p>Hoi &amp; dag</p>", "html")).toBe("Hoi & dag"));
});

describe("Graph-paden: alleen lezen, alleen vaste postbus-GUID", () => {
  const uid = "069ed1f9-ab7f-48bf-a5f8-500e7b40ccad";
  it("delta en bericht toegestaan", () => {
    expect(() => assertGraphUrl(`/users/${uid}/mailFolders/inbox/messages/delta?$select=id`)).not.toThrow();
    expect(() => assertGraphUrl(`/users/${uid}/messages/AAMkAD=?$select=uniqueBody,body`)).not.toThrow();
  });
  it("geen sendMail/move/attachments of e-mailadres als pad", () => {
    for (const p of [`/users/${uid}/sendMail`, `/users/${uid}/messages/AAMk/move`, `/users/${uid}/messages/AAMk/attachments`, `/users/${uid}/mailFolders/sentitems/messages/delta?x=1`, `/users/info@coffeeshopbond.nl/messages/AAMk?$select=body`])
      expect(() => assertGraphUrl(p)).toThrow();
  });
});

function harness(items: MailMeta[], opts: { failBodyTimes?: number; pages?: number } = {}) {
  const st = { checkpoint: null as string | null, messages: new Map<string, { id: string; status: string; attempts: number }>(), reviews: new Set<string>(), tasks: new Map<string, string>(), cands: new Set<string>(), bodies: 0 };
  let fails = opts.failBodyTimes ?? 0;
  const g: MailGraph = {
    async delta(cp) { return cp === "$deltatoken=done" ? { items: [], next: null, delta: "$deltatoken=done" } : { items, next: null, delta: "$deltatoken=done" }; },
    async body() { st.bodies++; if (fails-- > 0) throw new Error("Microsoft 503"); return "Graag het verweerschrift indienen bij de rechtbank."; },
  };
  const db: MailDb = {
    async codes() { return [{ project_id: "P1", reference_code: "BCD-WORLDLINE", active: true, archived: false }, { project_id: "P2", reference_code: "BCD-ARNHEM", active: false, archived: false }]; },
    async checkpoint() { return st.checkpoint; },
    async saveCheckpoint(t) { st.checkpoint = t; },
    async beginMessage(m, c) { const k = `${m.id}|${c.project_id}`; const r = st.messages.get(k) ?? { id: k, status: "in_behandeling", attempts: 0 }; if (r.status === "in_behandeling") r.attempts++; st.messages.set(k, r); return { ...r }; },
    async finishMessage(id, res) { const r = st.messages.get(id)!; if ("error" in res) { if (res.final) r.status = "fout"; } else r.status = "verwerkt"; },
    async review(key) { st.reviews.add(key); },
    async openTaskNorms() { return new Set(); },
    async createTask(_p, title, ref) { if (!st.tasks.has(ref)) st.tasks.set(ref, title); return ref; },
    async candidate(mid, c) { st.cands.add(`${mid}|${c.norm}`); },
  };
  const extract = async () => ({ stand_van_zaken: "Stand", vervolg: "", taken: [{ titel: "Verweerschrift indienen", bronzin: "Graag het verweerschrift indienen bij de rechtbank.", expliciet: true, eigenaar_genoemd: false, deadline_genoemd: false }], taakstatus: [] });
  return { st, g, db, extract };
}
const m = (id: string, subject: string): MailMeta => ({ id, subject, receivedDateTime: "2026-10-22T10:00:00Z" });

describe("run: routing, idempotentie, retry en checkpoint", () => {
  it("routeert alleen gecodeerde mails; onbekend/gepauzeerd/meerdere naar beoordeling", async () => {
    const h = harness([m("a", "[BCD-WORLDLINE] stand"), m("b", "gewone mail"), m("c", "[BCD-ONBEKEND] x"), m("d", "[BCD-ARNHEM] x"), m("e", "[BCD-WORLDLINE][BCD-ARNHEM]")]);
    const r = await runProjectMail(h.g, h.db, h.extract);
    expect(r).toMatchObject({ scanned: 5, coded: 4, processed: 1, tasks: 1 });
    expect([...h.st.reviews].map((k) => k.split("|").slice(1).join("|")).sort()).toEqual(["c|onbekende_code", "d|project_gepauzeerd", "e|meerdere_codes"]);
    expect(h.st.messages.has("b|P1")).toBe(false);
    expect(h.st.checkpoint).toBe("$deltatoken=done");
  });
  it("herhaalverwerking geeft geen nieuwe taak of nieuwe body-lezing", async () => {
    const h = harness([m("a", "[BCD-WORLDLINE] stand")]);
    await runProjectMail(h.g, h.db, h.extract);
    h.st.checkpoint = null; // replay vanaf begin
    await runProjectMail(h.g, h.db, h.extract);
    expect(h.st.tasks.size).toBe(1);
    expect(h.st.bodies).toBe(1);
  });
  it("tijdelijke fout: checkpoint niet opgeschoven; volgende run herstelt", async () => {
    const h = harness([m("a", "[BCD-WORLDLINE] stand")], { failBodyTimes: 1 });
    await expect(runProjectMail(h.g, h.db, h.extract)).rejects.toThrow(/onderbroken/);
    expect(h.st.checkpoint).toBeNull();
    await runProjectMail(h.g, h.db, h.extract);
    expect(h.st.messages.get("a|P1")!.status).toBe("verwerkt");
    expect(h.st.tasks.size).toBe(1);
  });
  it("na maximaal aantal pogingen: fout + beoordeling, checkpoint gaat door", async () => {
    const h = harness([m("a", "[BCD-WORLDLINE] stand")], { failBodyTimes: 99 });
    for (let i = 0; i < 4; i++) await expect(runProjectMail(h.g, h.db, h.extract)).rejects.toThrow();
    const r = await runProjectMail(h.g, h.db, h.extract);
    expect(r.failed).toBe(1);
    expect(h.st.messages.get("a|P1")!.status).toBe("fout");
    expect(h.st.checkpoint).toBe("$deltatoken=done");
  });
});
