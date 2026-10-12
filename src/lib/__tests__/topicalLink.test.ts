import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { GraphError } from "@/lib/plannerSync";
import { assertGraphUrl } from "@/lib/plannerGraph.server";
import {
  completeTopicalTask, completionBlocker, completionSummary, matchPlanner, matchTodo, parseTopicalRef, textHasTopicalRef,
  type CompletionPort, type TopicalLink,
} from "@/lib/topicalLink";

const PLAN = "ihOF3XJjZU-XVqZD1yqJ4JgAEVQ6";
const U = "11111111-1111-1111-1111-111111111111";
const link = (o: Partial<TopicalLink> = {}): TopicalLink => ({
  task_id: "t1", source_ref: "85959", todo_user_id: U, todo_list_id: "LISTAAAAAAAA", todo_task_id: "TODOAAAAAAAA", todo_match: "source_id",
  todo_completed_at: null, planner_plan_id: PLAN, planner_task_id: "PLANTASKAAAA", planner_completed_at: null, ...o,
});
function port(o: Partial<CompletionPort> = {}): CompletionPort {
  return {
    getTodo: vi.fn(async () => ({ id: "TODOAAAAAAAA", title: "X", body: "Topical actie 85959", status: "notStarted", linkedExternalIds: [], etag: "E1" })),
    completeTodo: vi.fn(async () => {}),
    getPlanner: vi.fn(async () => ({ etag: "P1", planId: PLAN, percentComplete: 50, description: "Bron: Topical BCD — actie 85959" })),
    completePlanner: vi.fn(async () => {}),
    ...o,
  };
}
const dbMock = () => { const saved: any[] = []; return { saved, saveLink: vi.fn(async (p: any) => { saved.push(p); }), markLocalDone: vi.fn(async () => {}), now: () => "2026-10-12T00:00:00Z" }; };

describe("bron-id", () => {
  it("leest de importregel", () => {
    expect(parseTopicalRef("Bron: Topical BCD — actie 85959\nmeer")).toBe("85959");
    expect(parseTopicalRef("Iets anders")).toBeNull();
  });
  it("matcht geen langer nummer of los getal", () => {
    expect(textHasTopicalRef("actie 859590", "85959")).toBe(false);
    expect(textHasTopicalRef("bedrag 85959", "85959")).toBe(false);
    expect(textHasTopicalRef("https://app.topicalmeetings.com/action/85959", "85959")).toBe(true);
  });
});

describe("matchen", () => {
  const locals = [{ id: "a", title: "Brief gemeente", source_ref: "1" }, { id: "b", title: "Agenda", source_ref: "2" }];
  it("koppelt alleen unieke bron-id automatisch; titel vraagt bevestiging", () => {
    const r = matchTodo(locals, [
      { id: "x", title: "iets", body: "actie 1", status: "notStarted", linkedExternalIds: [] },
      { id: "y", title: " agenda ", body: "", status: "notStarted", linkedExternalIds: [] },
    ]);
    expect(r[0]).toEqual({ taskId: "a", kind: "source_id", todoId: "x" });
    expect(r[1]).toEqual({ taskId: "b", kind: "title_only", todoIds: ["y"] });
  });
  it("dubbele titels/bron-id worden nooit automatisch gekoppeld", () => {
    const r = matchTodo(locals, [
      { id: "x", title: "a", body: "actie 1", status: "", linkedExternalIds: [] },
      { id: "z", title: "b", body: "actie 1", status: "", linkedExternalIds: [] },
      { id: "y1", title: "Agenda", body: "", status: "", linkedExternalIds: [] },
      { id: "y2", title: "Agenda", body: "", status: "", linkedExternalIds: [] },
    ]);
    expect(r[0].kind).toBe("ambiguous");
    expect(r[1]).toEqual({ taskId: "b", kind: "title_only", todoIds: ["y1", "y2"] });
  });
  it("Planner alleen binnen vast plan en op bron-id, nooit op titel", () => {
    const r = matchPlanner(locals, [
      { id: "p1", title: "Brief gemeente", description: "Bron: Topical BCD — actie 1", planId: "ANDERPLAN000" },
      { id: "p2", title: "Agenda", description: "geen bron", planId: PLAN },
    ], PLAN);
    expect(r.map((x) => x.kind)).toEqual(["none", "none"]);
  });
});

describe("afronden", () => {
  it("blokkeert zonder schrijfrecht of mapping", () => {
    expect(completionBlocker(link(), false, PLAN)).toMatch(/Tasks.ReadWrite.All/);
    expect(completionBlocker(null, true, PLAN)).toMatch(/Nog niet gekoppeld/);
    expect(completionBlocker(link({ planner_task_id: null }), true, PLAN)).toMatch(/Planner/);
    expect(completionBlocker(link(), true, PLAN)).toBeNull();
  });
  it("succes: beide met gelezen ETag, daarna pas lokaal afgerond", async () => {
    const p = port(), db = dbMock();
    const r = await completeTopicalTask(link(), p, db, PLAN);
    expect(p.completeTodo).toHaveBeenCalledWith(U, "LISTAAAAAAAA", "TODOAAAAAAAA", "E1");
    expect(p.completePlanner).toHaveBeenCalledWith("PLANTASKAAAA", "P1");
    expect(db.markLocalDone).toHaveBeenCalledOnce();
    expect(r.local).toBe("afgerond");
    expect(completionSummary(r).text).toMatch(/Topical verwerkt/);
  });
  it("403 bij To Do: geen lokale afronding, foutmelding over rechten", async () => {
    const db = dbMock();
    const r = await completeTopicalTask(link(), port({ completeTodo: vi.fn(async () => { throw new GraphError(403, "Microsoft 403"); }) }), db, PLAN);
    expect(r.todo.state).toBe("failed");
    expect(r.todo.message).toMatch(/geen rechten/);
    expect(db.markLocalDone).not.toHaveBeenCalled();
    expect(completionSummary(r).ok).toBe(false);
  });
  it("ETag-conflict bij Planner = partial; retry doet alleen Planner opnieuw", async () => {
    const db = dbMock();
    const p1 = port({ completePlanner: vi.fn(async () => { throw new GraphError(412, "Microsoft 412"); }) });
    const r1 = await completeTopicalTask(link(), p1, db, PLAN);
    expect(r1.todo.state).toBe("done");
    expect(r1.planner.message).toMatch(/versieconflict/);
    expect(db.saved[0].todo_completed_at).toBeTruthy();
    expect(db.saved[0].planner_completed_at).toBeNull();
    const p2 = port();
    const r2 = await completeTopicalTask(link({ todo_completed_at: db.saved[0].todo_completed_at }), p2, db, PLAN);
    expect(p2.getTodo).not.toHaveBeenCalled();
    expect(p2.completeTodo).not.toHaveBeenCalled();
    expect(r2.local).toBe("afgerond");
  });
  it("ontbrekende taak (404) en verloren bron-id schrijven niets", async () => {
    const p = port({
      getTodo: vi.fn(async () => { throw new GraphError(404, "Microsoft 404"); }),
      getPlanner: vi.fn(async () => ({ etag: "P", planId: PLAN, percentComplete: 0, description: "andere tekst" })),
    });
    const db = dbMock();
    const r = await completeTopicalTask(link(), p, db, PLAN);
    expect(r.todo.message).toMatch(/bestaat niet meer/);
    expect(r.planner.message).toMatch(/bron-id/);
    expect(p.completeTodo).not.toHaveBeenCalled();
    expect(p.completePlanner).not.toHaveBeenCalled();
    expect(db.markLocalDone).not.toHaveBeenCalled();
  });
  it("al voltooid extern: geen schrijfactie", async () => {
    const p = port({ getTodo: vi.fn(async () => ({ id: "x", title: "", body: "actie 85959", status: "completed", linkedExternalIds: [], etag: "E" })),
      getPlanner: vi.fn(async () => ({ etag: "P", planId: PLAN, percentComplete: 100, description: "Bron: Topical BCD — actie 85959" })) });
    const r = await completeTopicalTask(link(), p, dbMock(), PLAN);
    expect(p.completeTodo).not.toHaveBeenCalled();
    expect(r.local).toBe("afgerond");
  });
});

describe("beveiliging", () => {
  it("To Do-pad alleen voor Entra-GUID", () => {
    expect(() => assertGraphUrl(`/users/${U}/todo/lists/L1234567890/tasks/T1234567890`)).not.toThrow();
    expect(() => assertGraphUrl(`/users/someone@x.nl/todo/lists`)).toThrow();
  });
  it("alle Topical-serverfuncties controleren admin; migratie blokkeert lokaal afronden en non-admin RLS", () => {
    const src = readFileSync("src/lib/topical.functions.ts", "utf8");
    const fns = src.match(/createServerFn\(/g)!.length;
    expect(src.match(/await assertAdmin\(/g)!.length).toBe(fns);
    const sql = readFileSync("drizzle/migrations/0021_topical_source_links.sql", "utf8");
    expect(sql).toMatch(/todo_completed_at IS NOT NULL AND l.planner_completed_at IS NOT NULL/);
    expect(sql.match(/has_role\(auth.uid\(\),'admin'\)/g)!.length).toBeGreaterThanOrEqual(6);
    expect(sql).not.toMatch(/TO anon/);
  });
});
