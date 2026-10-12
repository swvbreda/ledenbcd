import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  canonRemote, decide, GraphError, hashCanon, percentToStatus, plannerToPriority, priorityToPlanner, remoteAssigneeToLocal,
  resolveConflictPatch, safeMsg, statusToPercent, syncProject, canonLocal,
  type DbPort, type GraphPort, type LocalTask, type RemoteTask, type TaskLink,
} from "@/lib/plannerSync";
import { assertGraphUrl, makeGraphClient, tokenRoles } from "@/lib/plannerGraph.server";
import { plannerReadiness } from "@/lib/plannerStatus";

const APP = "app-1";
const PLAN = "planAAAAAAAAAA";
const ENTRA = "11111111-1111-1111-1111-111111111111";
const lt = (o: Partial<LocalTask> = {}): LocalTask => ({ id: "t1", title: "Taak", description: null, deadline: null, priority: "normaal", status: "te_doen", assignee_id: null, ...o });
const rt = (o: Partial<RemoteTask> = {}): RemoteTask => ({ id: "r1", etag: "W/1", title: "Taak", percentComplete: 0, priority: 5, dueDateTime: null, assigneeIds: [], createdByAppId: APP, createdDateTime: new Date().toISOString(), description: "", detailsEtag: "D1", ...o });

function harness(tasks: LocalTask[], links: TaskLink[], remote: RemoteTask[], g: Partial<GraphPort> = {}) {
  const store = new Map(links.map((l) => [l.task_id, { ...l }]));
  const graph: GraphPort = {
    listBucketTasks: vi.fn(async () => remote),
    getDetails: vi.fn(async () => ({ description: "", etag: "D0" })),
    createTask: vi.fn(async () => ({ id: "new1", etag: "W/n" })),
    patchTask: vi.fn(async () => ({ etag: "W/2" })),
    patchDetails: vi.fn(async () => ({ etag: "D2" })),
    ...g,
  };
  const db: DbPort = {
    tasks: async () => tasks,
    links: async () => [...store.values()],
    linkedPlannerIds: async () => new Set<string>(),
    heartbeat: vi.fn(async () => {}),
    userMap: async () => [{ user_id: "u1", entra_id: ENTRA }],
    saveLink: vi.fn(async (l) => { store.set(l.task_id, { ...(store.get(l.task_id) ?? ({ plan_id: PLAN } as TaskLink)), ...l } as TaskLink); }),
    updateTask: vi.fn(async () => {}),
    insertTask: vi.fn(async () => "local-new"),
    newToken: () => "tok",
    now: () => new Date().toISOString(),
  };
  return { graph, db, store, run: () => syncProject({ projectId: "p", planId: PLAN, bucketId: "bucketAAAAAA", appId: APP, graph, db }) };
}
const baseLink = (o: Partial<TaskLink> = {}): TaskLink => ({ task_id: "t1", plan_id: PLAN, planner_task_id: null, state: "pending_create", attempt_token: null, attempt_started_at: null, task_etag: null, details_etag: null, last_local_hash: null, last_remote_hash: null, seen_local_hash: null, seen_remote_hash: null, last_error: null, ...o });

describe("planner: status- en prioriteitmapping", () => {
  it("vier lokale statussen naar 0/50/100", () => {
    expect([statusToPercent("te_doen"), statusToPercent("bezig"), statusToPercent("wacht"), statusToPercent("afgerond")]).toEqual([0, 50, 50, 100]);
  });
  it("50% houdt lokaal 'wacht', anders 'bezig'", () => {
    expect(percentToStatus(50, "wacht")).toBe("wacht");
    expect(percentToStatus(50, "te_doen")).toBe("bezig");
    expect(percentToStatus(100, "wacht")).toBe("afgerond");
    expect(percentToStatus(0, "bezig")).toBe("te_doen");
  });
  it("prioriteit hoog=3, normaal=5, laag=9 en terug; urgent (1) wordt hoog", () => {
    expect([priorityToPlanner("hoog"), priorityToPlanner("normaal"), priorityToPlanner("laag")]).toEqual([3, 5, 9]);
    expect(plannerToPriority(1)).toBe("hoog");
    expect(plannerToPriority(9)).toBe("laag");
  });
});

describe("planner: assignee mapping (BCD-id is geen Entra-id)", () => {
  it("alleen precies één gekoppelde persoon", () => {
    const userOf = (e: string) => (e === ENTRA ? "u1" : null);
    expect(remoteAssigneeToLocal([ENTRA], userOf)).toEqual({ ok: true, userId: "u1" });
    expect(remoteAssigneeToLocal(["x"], userOf).ok).toBe(false);
    expect(remoteAssigneeToLocal([ENTRA, "x"], userOf).ok).toBe(false);
  });
  it("lokale verantwoordelijke zonder koppeling wordt niet als Entra-id verstuurd", () => {
    expect(canonLocal(lt({ assignee_id: "u-unmapped" }), () => null).assignees).toBe("");
  });
});

describe("planner: geen dubbele aanmaak", () => {
  it("onzekere aanmaak wordt teruggevonden en gekoppeld, niet opnieuw aangemaakt", async () => {
    const h = harness([lt()], [baseLink({ state: "uncertain", attempt_started_at: new Date(Date.now() - 5 * 60_000).toISOString() })],
      [rt({ id: "r9", createdDateTime: new Date(Date.now() - 4 * 60_000).toISOString() })]);
    const r = await h.run();
    expect(h.graph.createTask).not.toHaveBeenCalled();
    expect(h.store.get("t1")?.planner_task_id).toBe("r9");
    expect(r.created).toBe(0);
  });
  it("timeout bij aanmaken markeert 'uncertain' en herhaalt niet binnen de wachttijd", async () => {
    const h = harness([lt()], [], [], { createTask: vi.fn(async () => { throw new GraphError(0, "timeout", true); }) });
    await h.run();
    expect(h.store.get("t1")?.state).toBe("uncertain");
    const second = await h.run();
    expect(h.graph.createTask).toHaveBeenCalledTimes(1);
    expect(second.warnings.join(" ")).toMatch(/onzeker/);
  });
  it("meerdere kandidaten na onzekere aanmaak: conflict, geen aanmaak", async () => {
    const old = new Date(Date.now() - 5 * 60_000).toISOString();
    const h = harness([lt()], [baseLink({ state: "uncertain", attempt_started_at: old })], [rt({ id: "a" }), rt({ id: "b" })]);
    const r = await h.run();
    expect(r.conflicts).toBe(1);
    expect(h.graph.createTask).not.toHaveBeenCalled();
  });
  it("koppeling wordt vóór de POST als 'creating' vastgelegd", async () => {
    const order: string[] = [];
    const h = harness([lt()], [], []);
    (h.db.saveLink as any).mockImplementation(async (l: any) => { order.push(`save:${l.state}`); });
    (h.graph.createTask as any).mockImplementation(async () => { order.push("post"); return { id: "n", etag: "e" }; });
    await h.run();
    expect(order.slice(0, 2)).toEqual(["save:creating", "post"]);
  });
});

describe("planner: conflicten en ETags", () => {
  it("beide kanten gewijzigd: conflict, niets overschreven", async () => {
    const base = hashCanon(canonRemote(rt()));
    const h = harness([lt({ title: "Lokaal nieuw" })], [baseLink({ state: "linked", planner_task_id: "r1", last_local_hash: base, last_remote_hash: base })], [rt({ title: "Planner nieuw" })]);
    const r = await h.run();
    expect(r.conflicts).toBe(1);
    expect(h.graph.patchTask).not.toHaveBeenCalled();
    expect(h.db.updateTask).not.toHaveBeenCalled();
  });
  it("PATCH met If-Match; 412 wordt conflict", async () => {
    const base = hashCanon(canonRemote(rt()));
    const h = harness([lt({ status: "afgerond" })], [baseLink({ state: "linked", planner_task_id: "r1", last_local_hash: base, last_remote_hash: base })], [rt()],
      { patchTask: vi.fn(async () => { throw new GraphError(412, "Microsoft 412"); }) });
    const r = await h.run();
    expect((h.graph.patchTask as any).mock.calls[0][1]).toBe("W/1");
    expect(r.conflicts).toBe(1);
    expect(h.store.get("t1")?.state).toBe("conflict");
  });
  it("alleen Planner gewijzigd: lokaal bijgewerkt", async () => {
    const base = hashCanon(canonLocal(lt(), () => null));
    const h = harness([lt()], [baseLink({ state: "linked", planner_task_id: "r1", last_local_hash: base, last_remote_hash: base })], [rt({ percentComplete: 100 })]);
    const r = await h.run();
    expect(r.updatedLocal).toBe(1);
    expect((h.db.updateTask as any).mock.calls[0][1].status).toBe("afgerond");
  });
  it("taak weg uit Planner: lokaal niets verwijderd", async () => {
    const h = harness([lt()], [baseLink({ state: "linked", planner_task_id: "gone" })], []);
    await h.run();
    expect(h.store.get("t1")?.state).toBe("remote_missing");
  });
  it("conflictkeuze bepaalt de richting", () => {
    expect(decide(resolveConflictPatch({ seen_local_hash: "L", seen_remote_hash: "R" }, "local"), "L", "R")).toBe("push");
    expect(decide(resolveConflictPatch({ seen_local_hash: "L", seen_remote_hash: "R" }, "planner"), "L", "R")).toBe("pull");
  });
});

describe("planner: Graph-client", () => {
  it("alleen vaste Microsoft-origin en toegestane paden (ook nextLink)", () => {
    expect(assertGraphUrl("/planner/plans/abcDEF123456/tasks")).toBe("https://graph.microsoft.com/v1.0/planner/plans/abcDEF123456/tasks");
    expect(() => assertGraphUrl("https://evil.example/v1.0/planner/tasks")).toThrow();
    expect(() => assertGraphUrl("/me/sendMail")).toThrow();
    expect(() => assertGraphUrl("https://graph.microsoft.com/v1.0/users/x/sendMail")).toThrow();
  });
  it("429 met Retry-After wordt opnieuw geprobeerd", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "Retry-After": "1" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ id: 1 }] }), { status: 200 }));
    const waits: number[] = [];
    const c = makeGraphClient("tok", f as any, { sleepFn: async (ms) => { waits.push(ms); } });
    expect(await c.list("/planner/plans/abcDEF123456/tasks")).toHaveLength(1);
    expect(waits).toEqual([1000]);
  });
  it("POST met 503 wordt niet herhaald en is 'onzeker'", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 503 }));
    const c = makeGraphClient("tok", f as any, { sleepFn: async () => {} });
    await expect(c.req("POST", "/planner/tasks", {})).rejects.toMatchObject({ status: 503, uncertain: true });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("POST met 429 (zeker geweigerd) wordt wel herhaald", async () => {
    const f = vi.fn().mockResolvedValueOnce(new Response("", { status: 429 })).mockResolvedValueOnce(new Response(JSON.stringify({ id: "x" }), { status: 201 }));
    const c = makeGraphClient("tok", f as any, { sleepFn: async () => {} });
    expect((await c.req("POST", "/planner/tasks", {})).json.id).toBe("x");
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("na harde einddatum geen nieuw verzoek meer", async () => {
    const f = vi.fn();
    const c = makeGraphClient("tok", f as any, { deadlineAt: Date.now() - 1 });
    await expect(c.req("POST", "/planner/tasks", {})).rejects.toMatchObject({ uncertain: false });
    expect(f).not.toHaveBeenCalled();
  });
  it("POST met 500 wordt niet blind herhaald en is 'onzeker'", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));
    const c = makeGraphClient("tok", f as any, { sleepFn: async () => {} });
    await expect(c.req("POST", "/planner/tasks", {})).rejects.toMatchObject({ status: 500, uncertain: true });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("foutmeldingen bevatten nooit token of secret", async () => {
    const tok = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJUYXNrcy5SZWFkV3JpdGUuQWxsIl19.sig_abc";
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "Forbidden", message: `Bearer ${tok}` } }), { status: 403 }));
    const c = makeGraphClient(tok, f as any);
    const e = await c.req("GET", "/planner/tasks/abc").catch((x) => x);
    expect(String(e.message)).not.toContain(tok);
    expect(safeMsg(new Error(`x Bearer ${tok} client_secret=zz`))).not.toMatch(/eyJ|zz/);
    expect(tokenRoles(tok)).toEqual(["Tasks.ReadWrite.All"]);
  });
});

describe("planner: eerlijke status en RBAC", () => {
  it("niet 'actief' zonder Planner-recht", () => {
    expect(plannerReadiness({ configured: true, roles: ["Calendars.ReadWrite"], canRead: false, canWrite: false, canListGroups: false, error: null }).level).toBe("blocked");
    expect(plannerReadiness({ configured: true, roles: ["Tasks.ReadWrite.All"], canRead: true, canWrite: true, canListGroups: false, error: null }).level).toBe("ok");
  });
  it("elke serverfunctie vereist sessie en admincheck", () => {
    const s = readFileSync("src/lib/planner.functions.ts", "utf8");
    const fns = s.match(/createServerFn\(/g)?.length ?? 0;
    expect(fns).toBe(11);
    expect(s.match(/\.middleware\(\[requireSupabaseAuth\]\)/g)?.length).toBe(fns);
    expect(s.match(/await assertAdmin\(/g)?.length).toBe(fns);
    expect(s).not.toMatch(/client\.server|supabaseAdmin/);
  });
  it("nieuwe tabellen alleen admin, geen DELETE-recht", () => {
    const m = readFileSync("drizzle/migrations/0019_planner_sync.sql", "utf8");
    expect(m).not.toMatch(/GRANT[^;]*DELETE[^;]*TO authenticated/);
    expect(m).not.toMatch(/TO anon/);
    expect(m.match(/ENABLE ROW LEVEL SECURITY/g)?.length).toBe(4);
    expect(m.match(/USING \(public\.has_role\(auth\.uid\(\),'admin'\)\)/g)?.length).toBe(8);
  });
});

// ---------- Gemockte Graph-adapter (HTTP-niveau) ----------
import { plannerPort } from "@/lib/plannerGraph.server";
import { LockLostError, syncOutcome } from "@/lib/plannerSync";

const BUCKET_A = "bucketAAAAAA";
const BUCKET_B = "bucketBBBBBB";
/** Minimale Planner-mock: buckets, taken, details (met ETag), POST/PATCH. */
function fakeGraph(o: { failDetails?: Set<string>; postStatus?: number } = {}) {
  const tasks = new Map<string, any>([
    ["ra", { id: "ra", bucketId: BUCKET_A, title: "In A", percentComplete: 0, priority: 5, "@odata.etag": "W/a", createdBy: { application: { id: "other" } } }],
    ["rb", { id: "rb", bucketId: BUCKET_B, title: "In B", percentComplete: 0, priority: 5, "@odata.etag": "W/b", createdBy: { application: { id: "other" } } }],
  ]);
  const details = new Map<string, any>([["ra", { description: "Omschrijving A", "@odata.etag": "DA" }], ["rb", { description: "B", "@odata.etag": "DB" }]]);
  const calls: string[] = [];
  const f = vi.fn(async (url: string, init: any) => {
    const path = new URL(url).pathname.replace("/v1.0", "");
    calls.push(`${init.method} ${path}${new URL(url).search}`);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
    let m;
    if ((m = path.match(/^\/planner\/buckets\/([^/]+)\/tasks$/))) return json({ value: [...tasks.values()].filter((t) => t.bucketId === m![1]) });
    if ((m = path.match(/^\/planner\/tasks\/([^/]+)\/details$/))) {
      if (init.method === "GET") return o.failDetails?.has(m[1]) ? json({ error: { code: "x" } }, 500) : json(details.get(m[1]) ?? { description: "", "@odata.etag": "D0" });
      details.set(m[1], { ...details.get(m[1]), ...JSON.parse(init.body), "@odata.etag": "D9" }); return json(details.get(m[1]));
    }
    if (path === "/planner/tasks" && init.method === "POST") {
      if (o.postStatus) return json({}, o.postStatus);
      const b = JSON.parse(init.body); const id = `new${tasks.size}`;
      tasks.set(id, { ...b, id, "@odata.etag": "W/n", createdBy: { application: { id: APP } } }); return json(tasks.get(id), 201);
    }
    if ((m = path.match(/^\/planner\/tasks\/([^/]+)$/)) && init.method === "PATCH") { tasks.set(m[1], { ...tasks.get(m[1]), ...JSON.parse(init.body), "@odata.etag": "W/p" }); return json(tasks.get(m[1])); }
    return json({ error: { code: "NotFound" } }, 404);
  });
  return { port: plannerPort(makeGraphClient("tok", f as any, { sleepFn: async () => {}, maxRetries: 1 })), calls, tasks, details };
}
function memDb(tasks: LocalTask[], links: TaskLink[] = [], globalLinked = new Set<string>()) {
  const store = new Map(links.map((l) => [l.task_id, { ...l }]));
  const inserted: any[] = [];
  const db: DbPort = {
    tasks: async () => tasks, links: async () => [...store.values()], linkedPlannerIds: async () => new Set(globalLinked),
    userMap: async () => [], heartbeat: vi.fn(async () => {}),
    saveLink: async (l) => { store.set(l.task_id, { ...(store.get(l.task_id) ?? ({ plan_id: PLAN } as TaskLink)), ...l } as TaskLink); },
    updateTask: vi.fn(async () => {}), insertTask: async (_p, t) => { inserted.push(t); return `loc${inserted.length}`; },
    newToken: () => "tok", now: () => new Date().toISOString(),
  };
  return { db, store, inserted };
}

describe("planner: Graph-mock pull/push en bucketscope", () => {
  it("lijst via standaard bucket-endpoint zonder $expand en haalt details expliciet op", async () => {
    const g = fakeGraph();
    const r = await g.port.listBucketTasks(BUCKET_A);
    expect(g.calls.some((c) => c.includes("$expand"))).toBe(false);
    expect(g.calls).toContain("GET /planner/tasks/ra/details");
    expect(r[0]).toMatchObject({ description: "Omschrijving A", detailsEtag: "DA", detailsError: null });
  });
  it("pull: alleen taken uit de eigen bucket worden overgenomen, met omschrijving", async () => {
    const g = fakeGraph(); const m = memDb([]);
    const res = await syncProject({ projectId: "pA", planId: PLAN, bucketId: BUCKET_A, appId: APP, graph: g.port, db: m.db });
    expect(res.imported).toBe(1);
    expect(m.inserted.map((t) => t.title)).toEqual(["In A"]);
    expect(m.inserted[0].description).toBe("Omschrijving A");
    expect(g.calls.some((c) => c.includes(BUCKET_B))).toBe(false);
  });
  it("2 projecten, 1 plan: elk project ziet alleen zijn eigen bucket", async () => {
    const g = fakeGraph();
    const a = memDb([]), b = memDb([]);
    await syncProject({ projectId: "pA", planId: PLAN, bucketId: BUCKET_A, appId: APP, graph: g.port, db: a.db });
    await syncProject({ projectId: "pB", planId: PLAN, bucketId: BUCKET_B, appId: APP, graph: g.port, db: b.db });
    expect(a.inserted.map((t) => t.title)).toEqual(["In A"]);
    expect(b.inserted.map((t) => t.title)).toEqual(["In B"]);
  });
  it("taak die elders al gekoppeld is wordt niet nogmaals overgenomen", async () => {
    const g = fakeGraph(); const m = memDb([], [], new Set(["ra"]));
    const res = await syncProject({ projectId: "pA", planId: PLAN, bucketId: BUCKET_A, appId: APP, graph: g.port, db: m.db });
    expect(res.imported).toBe(0);
  });
  it("push: nieuwe taak wordt in de gekoppelde bucket aangemaakt met omschrijving", async () => {
    const g = fakeGraph(); const m = memDb([lt({ id: "t1", title: "Nieuw", description: "Tekst" })], [], new Set(["ra"]));
    const res = await syncProject({ projectId: "pA", planId: PLAN, bucketId: BUCKET_A, appId: APP, graph: g.port, db: m.db });
    expect(res.created).toBe(1);
    const created = [...g.tasks.values()].find((t) => t.title === "Nieuw");
    expect(created.bucketId).toBe(BUCKET_A);
    expect(g.details.get(created.id).description).toBe("Tekst");
    const l = m.store.get("t1")!;
    expect(l.last_local_hash).toBe(l.last_remote_hash);
    expect(syncOutcome(res)).toBe("success");
  });
  it("falende details bij gekoppelde taak: niets geschreven, geen succes-hash, gedeeltelijk", async () => {
    const g = fakeGraph({ failDetails: new Set(["ra"]) });
    const base = baseLink({ state: "linked", planner_task_id: "ra", last_local_hash: "L0", last_remote_hash: "R0" });
    const m = memDb([lt({ id: "t1", title: "Lokaal anders", description: "x" })], [base]);
    const res = await syncProject({ projectId: "pA", planId: PLAN, bucketId: BUCKET_A, appId: APP, graph: g.port, db: m.db });
    expect(m.store.get("t1")).toMatchObject({ last_local_hash: "L0", last_remote_hash: "R0" });
    expect(g.calls.some((c) => c.startsWith("PATCH"))).toBe(false);
    expect(m.db.updateTask).not.toHaveBeenCalled();
    expect(syncOutcome(res)).toBe("partial");
  });
  it("falende details bij nieuwe Planner-taak: niet overgenomen", async () => {
    const g = fakeGraph({ failDetails: new Set(["ra"]) }); const m = memDb([]);
    const res = await syncProject({ projectId: "pA", planId: PLAN, bucketId: BUCKET_A, appId: APP, graph: g.port, db: m.db });
    expect(res.imported).toBe(0);
    expect(res.warnings.join(" ")).toMatch(/details niet leesbaar/);
  });
  it("omschrijving-update mislukt bij push: basis niet als succes vastgelegd, volgende sync pusht opnieuw", async () => {
    const remote = rt({ id: "r1", title: "Oud", description: "oud", detailsEtag: "D1" });
    const base = hashCanon(canonRemote(remote));
    const h = harness([lt({ title: "Nieuw", description: "nieuw" })], [baseLink({ state: "linked", planner_task_id: "r1", last_local_hash: base, last_remote_hash: base })], [remote],
      { patchDetails: vi.fn(async () => { throw new GraphError(500, "Microsoft 500"); }) });
    const r = await h.run();
    const l = h.store.get("t1")!;
    expect(l.last_local_hash).toBe(base);
    expect(l.last_local_hash).not.toBe(hashCanon(canonLocal(lt({ title: "Nieuw", description: "nieuw" }), () => null)));
    expect(r.updatedRemote).toBe(0);
    expect(decide(l, hashCanon(canonLocal(lt({ title: "Nieuw", description: "nieuw" }), () => null)), hashCanon({ ...canonRemote(remote), title: "Nieuw" }))).toBe("push");
  });
  it("ontbrekende details-ETag bij push: geen succes, waarschuwing", async () => {
    const remote = rt({ id: "r1", description: "oud", detailsEtag: null });
    const base = hashCanon(canonRemote(remote));
    const h = harness([lt({ description: "nieuw" })], [baseLink({ state: "linked", planner_task_id: "r1", last_local_hash: base, last_remote_hash: base })], [remote]);
    const r = await h.run();
    expect(h.store.get("t1")!.last_local_hash).toBe(base);
    expect(r.warnings.join(" ")).toMatch(/ETag/);
  });
  it("aanmaak na POST 503: onzeker, één POST, en na wachttijd niet opnieuw aangemaakt", async () => {
    const g = fakeGraph({ postStatus: 503 }); const m = memDb([lt({ id: "t1", title: "X" })], [], new Set(["ra"]));
    await syncProject({ projectId: "pA", planId: PLAN, bucketId: BUCKET_A, appId: APP, graph: g.port, db: m.db });
    expect(m.store.get("t1")!.state).toBe("uncertain");
    m.store.set("t1", { ...m.store.get("t1")!, attempt_started_at: new Date(Date.now() - 60 * 60_000).toISOString() });
    const res = await syncProject({ projectId: "pA", planId: PLAN, bucketId: BUCKET_A, appId: APP, graph: g.port, db: m.db });
    expect(g.calls.filter((c) => c.startsWith("POST")).length).toBe(1);
    expect(res.warnings.join(" ")).toMatch(/beheerder/);
    expect(m.store.get("t1")!.state).toBe("uncertain");
  });
  it("beheerderkeuze 'opnieuw aanmaken' maakt pas daarna nieuw aan", async () => {
    const { resolveUncertainPatch } = await import("@/lib/plannerSync");
    const h = harness([lt()], [baseLink({ state: "uncertain", attempt_started_at: new Date(Date.now() - 60 * 60_000).toISOString() })], []);
    await h.run();
    expect(h.graph.createTask).not.toHaveBeenCalled();
    h.store.set("t1", { ...h.store.get("t1")!, ...resolveUncertainPatch("retry_create")! });
    await h.run();
    expect(h.graph.createTask).toHaveBeenCalledTimes(1);
  });
  it("verloren projectslot stopt de run zonder verdere writes", async () => {
    const h = harness([lt({ id: "t1" }), lt({ id: "t2", title: "Twee" })], [], []);
    let n = 0;
    (h.db.heartbeat as any).mockImplementation(async () => { if (++n > 3) throw new LockLostError("slot weg"); });
    await expect(h.run()).rejects.toBeInstanceOf(LockLostError);
    expect((h.graph.createTask as any).mock.calls.length).toBeLessThan(2);
  });
  it("conflicten of waarschuwingen geven 'partial', niet volledig succes", () => {
    expect(syncOutcome({ imported: 0, created: 0, updatedRemote: 0, updatedLocal: 0, conflicts: 1, warnings: [] })).toBe("partial");
    expect(syncOutcome({ imported: 0, created: 0, updatedRemote: 0, updatedLocal: 0, conflicts: 0, warnings: ["x"] })).toBe("partial");
  });
  it("server: alleen doelplan, gearchiveerd project geweigerd", () => {
    const s = readFileSync("src/lib/planner.functions.ts", "utf8");
    expect(s).toContain('PLANNER_TARGET_PLAN_ID = "ihOF3XJjZU-XVqZD1yqJ4JgAEVQ6"');
    expect(s).toMatch(/archived_at\) throw new Error/);
  });
});
