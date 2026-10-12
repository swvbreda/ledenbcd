import { describe, it, expect } from "vitest";
import { isValidTeamsUrl, isOverdue, filterTasks } from "@/lib/internalWork";

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
