import { describe, it, expect } from "vitest";
import { isValidTeamsUrl, isOverdue, filterTasks, groupMinutesResponsibles } from "@/lib/internalWork";

describe("Teams-link", () => {
  it("accepteert https Teams-link", () => expect(isValidTeamsUrl("https://teams.microsoft.com/l/channel/abc")).toBe(true));
  it("weigert http", () => expect(isValidTeamsUrl("http://teams.microsoft.com/l/x")).toBe(false));
  it("weigert lookalike domein", () => expect(isValidTeamsUrl("https://teams.microsoft.com.evil.nl/x")).toBe(false));
  it("weigert javascript", () => expect(isValidTeamsUrl("javascript:alert(1)")).toBe(false));
});

describe("taken", () => {
  const today = "2026-10-12";
  const tasks = [
    { id: 1, status: "te_doen" as const, deadline: "2026-10-01", assignee_id: "u1", project_id: "p1" },
    { id: 2, status: "afgerond" as const, deadline: "2026-10-01", assignee_id: "u1", project_id: null },
    { id: 3, status: "bezig" as const, deadline: "2026-10-20", assignee_id: "u2", project_id: "p1" },
  ];
  it("afgeronde taak is nooit verlopen", () => expect(isOverdue(tasks[1], today)).toBe(false));
  it("vandaag is niet verlopen", () => expect(isOverdue({ status: "te_doen", deadline: today }, today)).toBe(false));
  it("mijn verlopen open taken", () =>
    expect(filterTasks(tasks, { projectId: "all", status: "open", mine: true, overdue: true }, "u1", today).map((t) => t.id)).toEqual([1]));
  it("projectfilter", () =>
    expect(filterTasks(tasks, { projectId: "p1", status: "all", mine: false, overdue: false }, null, today).map((t) => t.id)).toEqual([1, 3]));
  it("mijn taken zonder account is leeg", () =>
    expect(filterTasks(tasks, { projectId: "all", status: "all", mine: true, overdue: false }, null, today)).toEqual([]));
});

import { splitTaskViews, viewForTask, markCompletedInList } from "@/lib/internalWork";
describe("Open taken / Afgerond", () => {
  const today = "2026-10-12";
  const tasks = [
    { id: "a", status: "te_doen" as const, deadline: "2026-10-01", assignee_id: "u1", project_id: "p1" },
    { id: "b", status: "afgerond" as const, deadline: "2026-10-01", assignee_id: "u1", project_id: "p1" },
    { id: "c", status: "bezig" as const, deadline: null, assignee_id: "u2", project_id: null },
    { id: "d", status: "afgerond" as const, deadline: null, assignee_id: "u2", project_id: null },
  ];
  const f = { projectId: "all", openStatus: "open" as const, mine: false, overdue: false };
  it("open bevat nooit afgerond; afgerond alleen afgerond", () => {
    const r = splitTaskViews(tasks, f, "u1", today);
    expect(r.open.map((t) => t.id)).toEqual(["a", "c"]);
    expect(r.done.map((t) => t.id)).toEqual(["b", "d"]);
  });
  it("verlopen-filter raakt afgerond niet; project/mijn wel", () => {
    const r = splitTaskViews(tasks, { ...f, overdue: true, mine: true }, "u1", today);
    expect(r.open.map((t) => t.id)).toEqual(["a"]);
    expect(r.done.map((t) => t.id)).toEqual(["b"]);
  });
  it("deep-link naar afgeronde taak kiest Afgerond", () => {
    expect(viewForTask(tasks, "b")).toBe("afgerond");
    expect(viewForTask(tasks, "a")).toBe("open");
    expect(viewForTask(tasks, "x")).toBeNull();
  });
  it("na afronden verdwijnt taak uit open en telt mee in afgerond", () => {
    const next = markCompletedInList(tasks, "a")!;
    const r = splitTaskViews(next, f, null, today);
    expect(r.open.map((t) => t.id)).toEqual(["c"]);
    expect(r.done.length).toBe(3);
  });
});

describe("gedeelde notulen-verantwoordelijken in Mijn taken", () => {
  const links = [
    { id: "a1", task_id: "t-board", collective_board: true },
    { id: "a2", task_id: "t-pair", collective_board: false },
  ];
  const board = ["u1","u2","u3","u4","u5","u6"].map((u, i) => ({ action_id: "a1", user_id: u, name: `Lid ${i + 1}` }))
    .concat([{ action_id: "a1", user_id: null as any, name: "Tim de Wilde" }]);
  const assignees = [{ action_id: "a2", user_id: "u1" }, { action_id: "a2", user_id: "u2" }];
  const map = groupMinutesResponsibles(links, assignees, board, (u) => (u === "u1" ? "Simone" : u === "u2" ? "Bernard" : u));
  const tasks = [
    { id: "t-board", status: "te_doen" as const, deadline: null, assignee_id: "u1", project_id: null, responsible_ids: map.get("t-board")!.userIds },
    { id: "t-pair", status: "te_doen" as const, deadline: null, assignee_id: "u1", project_id: null, responsible_ids: map.get("t-pair")!.userIds },
    { id: "t-solo", status: "te_doen" as const, deadline: null, assignee_id: "u2", project_id: null },
    { id: "t-other", status: "te_doen" as const, deadline: null, assignee_id: "u9", project_id: null },
  ];
  const mine = (u: string) => filterTasks(tasks, { projectId: "all", status: "open", mine: true, overdue: false }, u, "2026-11-10").map((t) => t.id);
  it("elk van de zes bestuursaccounts ziet de gedeelde taak precies één keer", () => {
    for (const u of ["u1","u2","u3","u4","u5","u6"]) expect(mine(u).filter((id) => id === "t-board")).toHaveLength(1);
    expect(map.get("t-board")!.names).toHaveLength(7);
    expect(map.get("t-board")!.names).toContain("Tim de Wilde");
  });
  it("Bernard krijgt ook de Simone+Bernard-taak", () => {
    expect(mine("u2")).toEqual(["t-board", "t-pair", "t-solo"]);
    expect(map.get("t-pair")!.names).toEqual(["Simone", "Bernard"]);
  });
  it("enkelvoudige toewijzing blijft werken en niet-toegewezen ziet niets extra", () => {
    expect(mine("u9")).toEqual(["t-other"]);
    expect(mine("u7")).toEqual([]);
  });
});
