import { describe, expect, it, vi } from "vitest";
import { runImport, toAgendaItem, toAmsterdam, type ImportDb, type ImportGraph } from "@/lib/msImport";
import { importGraphPort, nextPageParams, readOnlyGraph } from "@/lib/msImportGraph.server";
import { handleScheduledImport } from "@/lib/msImportWorker.server";

const USER = "11111111-2222-3333-4444-555555555555";
const ev = (o: Record<string, unknown> = {}) => ({ id: "E1", subject: "Bestuur", type: "singleInstance", isCancelled: false,
  start: { dateTime: "2026-03-10T10:00:00.0000000", timeZone: "Europe/Amsterdam" }, end: { dateTime: "2026-03-10T11:00:00.0000000", timeZone: "Europe/Amsterdam" }, ...o });

function db(over: Partial<ImportDb> = {}): ImportDb & { agenda: any[]; planner: any[] } {
  const agenda: any[] = [], planner: any[] = [];
  return {
    agenda, planner,
    settings: async () => ({ agenda_user_id: USER, agenda_calendar_id: "CAL", planner_mode: "import", planner_general_bucket_id: null }),
    linkedBuckets: async () => ["B1"],
    applyAgenda: async (_c, items, complete) => { agenda.push({ items, complete }); return { created: items.length }; },
    applyPlanner: async (b, items, complete) => { planner.push({ b, items, complete }); return { created: items.length }; },
    ...over,
  };
}
const graph = (o: Partial<ImportGraph> = {}): ImportGraph => ({
  calendarView: async () => ({ items: [ev()], complete: true, error: null }),
  bucketTasks: async () => ({ items: [], complete: true, error: null }),
  ...o,
});

describe("agenda-omzetting", () => {
  it("UTC naar Amsterdam over zomertijdgrens", () => {
    expect(toAmsterdam({ dateTime: "2026-03-29T08:00:00", timeZone: "UTC" })).toEqual({ date: "2026-03-29", time: "10:00" });
    expect(toAmsterdam({ dateTime: "2026-03-28T08:00:00", timeZone: "UTC" })).toEqual({ date: "2026-03-28", time: "09:00" });
  });
  it("onbekende tijdzone wordt niet gegokt", () => {
    expect(toAmsterdam({ dateTime: "2026-03-10T10:00:00", timeZone: "Pacific Standard Time" })).toBeNull();
  });
  it("serie-master overgeslagen, losse herhaling behoudt eigen id en annulering", () => {
    expect(toAgendaItem(ev({ type: "seriesMaster" }) as any)).toBeNull();
    const o = toAgendaItem(ev({ id: "OCC2", type: "occurrence", seriesMasterId: "M", isCancelled: true }) as any)!;
    expect(o.event_id).toBe("OCC2"); expect(o.series_master_id).toBe("M"); expect(o.cancelled).toBe(true);
  });
  it("alleen Teams-links worden bewaard", () => {
    expect(toAgendaItem(ev({ onlineMeeting: { joinUrl: "https://evil.example/x" } }) as any)!.teams_url).toBeNull();
    expect(toAgendaItem(ev({ onlineMeeting: { joinUrl: "https://teams.microsoft.com/l/x" } }) as any)!.teams_url).toContain("teams");
  });
});

describe("runImport", () => {
  it("zonder bevestigde agenda wordt niets gelezen", async () => {
    const cv = vi.fn();
    const r = await runImport(graph({ calendarView: cv }), db({ settings: async () => ({ agenda_user_id: USER, agenda_calendar_id: null, planner_mode: "import", planner_general_bucket_id: null }) }));
    expect(cv).not.toHaveBeenCalled(); expect(r.agenda.status).toBe("skipped");
  });
  it("paginafout/403 = onvolledig, geen afwezigheidsconclusie", async () => {
    const d = db();
    const r = await runImport(graph({ calendarView: async () => ({ items: [ev()], complete: false, error: "403" }) }), d);
    expect(r.agenda.status).toBe("partial"); expect(d.agenda[0].complete).toBe(false);
  });
  it("dubbele ids binnen één lezing worden één item", async () => {
    const d = db();
    await runImport(graph({ calendarView: async () => ({ items: [ev(), ev()], complete: true, error: null }) }), d);
    expect(d.agenda[0].items).toHaveLength(1);
  });
  it("Planner: Topical en onleesbare details overgeslagen, dan geen volledigheid", async () => {
    const d = db();
    await runImport(graph({ bucketTasks: async () => ({ complete: true, error: null, items: [
      { id: "T1", title: "Gewoon", percentComplete: 100, dueDateTime: "2026-04-01T00:00:00Z", assigneeIds: ["A"], description: "" },
      { id: "T2", title: "Topical", percentComplete: 0, dueDateTime: null, assigneeIds: [], description: "[topical:abc]" },
      { id: "T3", title: "?", percentComplete: 0, dueDateTime: null, assigneeIds: [], description: null, detailsError: "403" },
    ] }) }), d);
    const ids = d.planner[0].items.map((i: any) => i.id);
    expect(ids).toContain("T1"); expect(ids).not.toContain("T3");
    expect(d.planner[0].complete).toBe(false);
    expect(d.planner[0].items.find((i: any) => i.id === "T1").percent).toBe(100);
  });
  it("tweerichtingsmodus: Planner niet geïmporteerd", async () => {
    const d = db({ settings: async () => ({ agenda_user_id: null, agenda_calendar_id: null, planner_mode: "two_way", planner_general_bucket_id: null }) });
    const r = await runImport(graph(), d);
    expect(d.planner).toHaveLength(0); expect(r.plannerSkipped).toMatch(/leesmodus/);
  });
});

describe("alleen-lezen Graph", () => {
  it("doet uitsluitend GET, ook voor Planner-details", async () => {
    const req = vi.fn(async (_m: string, path: string) => ({ etag: null, json: path.includes("/details") ? { description: "" } : { value: [{ id: "T", title: "x", bucketId: "B1" }] } }));
    await importGraphPort(readOnlyGraph({ req })).bucketTasks("B1");
    await importGraphPort(readOnlyGraph({ req })).calendarView(USER, "CAL", "a", "b");
    expect(req.mock.calls.every((c) => c[0] === "GET")).toBe(true);
  });
  it("vervolgpagina naar andere origin geweigerd", () => {
    expect(() => nextPageParams("https://evil.example/v1.0/x?$skip=2")).toThrow();
    expect(nextPageParams(undefined)).toBeNull();
  });
});

describe("geplande route", () => {
  const env = { INTERNAL_WEBHOOK_SECRET: "s3cret" };
  const mk = (settings: any, admin = true) => {
    const graphFn = vi.fn();
    const sb: any = { from: () => ({ select: () => ({ maybeSingle: async () => ({ data: settings, error: null }) }) }), rpc: async () => ({ data: admin }) };
    return { graphFn, deps: async () => ({ sb, graph: graphFn }) };
  };
  const req = (k?: string) => new Request("http://x", { method: "POST", headers: k ? { "x-internal-secret": k } : {} });
  it("verkeerde sleutel = 401, geen Microsoft-lezing", async () => {
    const m = mk({ enabled: true, release_gate: true, updated_by: USER });
    expect((await handleScheduledImport(req("nope!!"), env, m.deps)).status).toBe(401);
    expect(m.graphFn).not.toHaveBeenCalled();
  });
  it("uit of zonder releasegate = niets", async () => {
    for (const s of [{ enabled: false, release_gate: true, updated_by: USER }, { enabled: true, release_gate: false, updated_by: USER }]) {
      const m = mk(s); await handleScheduledImport(req("s3cret"), env, m.deps); expect(m.graphFn).not.toHaveBeenCalled();
    }
  });
  it("actor niet meer admin = geweigerd", async () => {
    const m = mk({ enabled: true, release_gate: true, updated_by: USER }, false);
    expect((await handleScheduledImport(req("s3cret"), env, m.deps)).status).toBe(409);
    expect(m.graphFn).not.toHaveBeenCalled();
  });
});

import { IMPORT_CALENDAR_ID, IMPORT_MAILBOX_ENTRA_ID } from "@/lib/msImport";
describe("bevestigde bron", () => {
  it("agenda-id en account passen in de opslagcontroles", () => {
    expect(IMPORT_CALENDAR_ID).toMatch(/^[A-Za-z0-9_=+/-]{1,512}$/);
    expect(IMPORT_MAILBOX_ENTRA_ID).toMatch(/^[0-9a-f-]{36}$/);
  });
});
