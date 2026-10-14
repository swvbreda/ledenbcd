import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import DossierGroupsView from "@/components/projecten/DossierGroupsView";
import { DossierStatusBlock } from "@/components/projecten/DossierStatusBlock";
import { setDossierStatus } from "@/hooks/useDossierRegister";
import type { RegisterDossier } from "@/lib/dossierRegister";

afterEach(cleanup);
const d = (id: string, name: string, parent_id: string | null = null, extra: Partial<RegisterDossier> = {}): RegisterDossier =>
  ({ id, name, parent_id, sort_order: 0, jaarplan_kind: null, jaarplan_section: null, jaarplan_pages: null, note: null, archived_at: null, project_hidden_at: null, ...extra });

describe("Algemene dossierstatus", () => {
  it("leeg toont 'nog niet vastgelegd', ook als subdossier gekozen is; nooit afgeleid uit project", () => {
    const ds = [d("s", "Schaarse vergunningen"), d("c", "Sub", "s")];
    render(<DossierGroupsView dossiers={ds} links={[{ dossier_id: "c", project_id: "p" }]}
      projects={[{ id: "p", title: "Project X", archived_at: null, status: "actief" }]} selected="c" onOpen={vi.fn()} onSetStatus={vi.fn()} />);
    expect(screen.getByText("Algemene status nog niet vastgelegd")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Dossierstatus Schaarse vergunningen bewerken/ })).toBeTruthy();
  });
  it("toont tekst en datum; zonder onSave geen bewerkknop", () => {
    render(<DossierStatusBlock name="A" summary="Loopt" date="2026-10-06" />);
    expect(screen.getByText("Loopt")).toBeTruthy();
    expect(screen.getByText("Stand per 6 oktober 2026")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
  it("bewerken slaat op; fout blijft in dialoog zichtbaar", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error("Geen toegang")).mockResolvedValueOnce(undefined);
    render(<DossierStatusBlock name="A" summary={null} date={null} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: /bewerken/ }));
    fireEvent.change(screen.getByLabelText("Algemene status"), { target: { value: "Nieuw" } });
    fireEvent.click(screen.getByRole("button", { name: "Opslaan" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain("Geen toegang");
    fireEvent.click(screen.getByRole("button", { name: "Opslaan" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onSave).toHaveBeenLastCalledWith("Nieuw", "");
  });
  it("update raakt alleen status_summary/status_date en vereist teruggelezen rij", async () => {
    const calls: any[] = [];
    const mk = (rows: unknown[]) => { const c: any = { update: (v: any) => (calls.push(v), c), eq: () => c, select: async () => ({ data: rows, error: null }) }; return { from: () => c }; };
    await setDossierStatus(mk([{ id: "x" }]), "x", "  ", "bad");
    expect(calls[0]).toEqual({ status_summary: null, status_date: null });
    await expect(setDossierStatus(mk([]), "x", "a", "2026-10-06")).rejects.toThrow("Geen toegang");
  });
});
