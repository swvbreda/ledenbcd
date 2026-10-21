import { describe, expect, it } from "vitest";
import { AGENDA_ITEMS, NOT_SET, buildAgenda, discussionPoints, recordedStand, type AgendaProject, type AgendaTask } from "../meetingAgenda";

const P = (id: string, o: Partial<AgendaProject> = {}): AgendaProject => ({ id, title: id, status: "actief", archived_at: null, owner_id: null, description: null, ...o });
const T = (id: string, project_id: string | null, o: Partial<AgendaTask> = {}): AgendaTask => ({ id, title: id, project_id, status: "te_doen", deadline: null, assignee_id: null, ...o });
const dossiers: any[] = [{ id: "d1", parent_id: null, name: "PCN" }, { id: "d1a", parent_id: "d1", name: "Sub" }, { id: "d2", parent_id: null, name: "Overig" }];
const links = [{ dossier_id: "d1a", project_id: "a" }, { dossier_id: "d2", project_id: "b" }];
const projects = [P("a"), P("b", { status: "gepauzeerd" }), P("c", { status: "te_bevestigen" }), P("done", { status: "afgerond" }), P("arch", { archived_at: "2026-01-01" })];
const tasks = [T("a1", "a"), T("a2", "a", { status: "afgerond" }), T("b1", "b"), T("loose", null), T("onArchived", "arch")];

describe("vergaderagenda", () => {
  it("vaste volgorde van zes punten", () => expect(AGENDA_ITEMS[0]).toBe("Opening en vaststellen agenda") );
  it("zes punten, projectvoortgang op 3", () => { expect(AGENDA_ITEMS).toHaveLength(6); expect(AGENDA_ITEMS[2]).toBe("Projectvoortgang"); });
  it("gearchiveerde projecten nooit, afgerond apart", () => {
    const a = buildAgenda(projects, tasks, links, dossiers, { projectId: null, dossierId: null });
    expect(a.active.map((r) => r.project.id)).toEqual(["a", "c", "b"]);
    expect(a.completed.map((r) => r.project.id)).toEqual(["done"]);
  });
  it("afgeronde acties nooit bij open acties", () => {
    const a = buildAgenda(projects, tasks, links, dossiers, { projectId: null, dossierId: null });
    expect(a.active.find((r) => r.project.id === "a")!.openTasks.map((t) => t.id)).toEqual(["a1"]);
  });
  it("acties zonder zichtbaar project alleen ongefilterd", () => {
    expect(buildAgenda(projects, tasks, links, dossiers, { projectId: null, dossierId: null }).unscoped.map((t) => t.id)).toEqual(["loose", "onArchived"]);
    expect(buildAgenda(projects, tasks, links, dossiers, { projectId: "a", dossierId: null }).unscoped).toEqual([]);
  });
  it("dossierfilter omvat subdossiers, niets anders", () => {
    const a = buildAgenda(projects, tasks, links, dossiers, { projectId: null, dossierId: "d1" });
    expect(a.active.map((r) => r.project.id)).toEqual(["a"]);
    expect(a.openActionCount).toBe(1);
  });
  it("projectfilter toont alleen dat project", () => expect(buildAgenda(projects, tasks, links, dossiers, { projectId: "b", dossierId: null }).active.map((r) => r.project.id)).toEqual(["b"]));
  it("geen verzonnen stand of bespreekpunten", () => { expect(recordedStand(P("x"))).toBeNull(); expect(discussionPoints(P("x"))).toEqual([]); expect(NOT_SET).toBe("Nog niet vastgelegd"); });
  it("bespreekpunten uit opmerkingen en Vervolg", () => expect(discussionPoints(P("x", { remarks: "Besluit nodig", project_plan: "Vervolg\n- Brief sturen" }))).toEqual(["Besluit nodig", "• Brief sturen"]));
});
