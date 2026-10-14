import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import DossierGroupsView from "@/components/projecten/DossierGroupsView";
import type { RegisterDossier } from "@/lib/dossierRegister";

afterEach(cleanup);
const d = (id: string, name: string, parent_id: string | null = null): RegisterDossier =>
  ({ id, name, parent_id, sort_order: 0, jaarplan_kind: null, jaarplan_section: null, jaarplan_pages: null, note: null, archived_at: null, project_hidden_at: null });
const ds = [d("a", "Amsterdam"), d("o", "Overleg burgemeester", "a"), d("b", "Banken")];

describe("DossierGroupsView zonder projecten", () => {
  it("geselecteerd leeg subdossier toont kop met Verwijderen", () => {
    render(<DossierGroupsView dossiers={ds} links={[]} projects={[]} selected="o" onOpen={vi.fn()} onSetHidden={vi.fn()} />);
    expect(screen.getByText("Overleg burgemeester")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Overleg burgemeester verwijderen/ })).toBeTruthy();
  });
  it("alle lege hoofddossiers tonen hun verwijderknop", () => {
    render(<DossierGroupsView dossiers={ds} links={[]} projects={[]} onOpen={vi.fn()} onSetHidden={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Amsterdam verwijderen/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Banken verwijderen/ })).toBeTruthy();
  });
  it("zonder dossiers en projecten een nette lege melding", () => {
    render(<DossierGroupsView dossiers={[]} links={[]} projects={[]} onOpen={vi.fn()} />);
    expect(screen.getByText("Geen dossiers om te tonen.")).toBeTruthy();
  });
});
