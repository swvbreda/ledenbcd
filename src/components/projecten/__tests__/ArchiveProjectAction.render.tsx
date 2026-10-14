import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { ArchiveProjectAction, setProjectArchived } from "../ArchiveProjectAction";
afterEach(cleanup);

const PID = "aa2935e1-fdf8-4d7d-808b-980fa55209c1";
function fakeDb() {
  const calls: any[] = [];
  const db = { from: (t: string) => { calls.push(["from", t]); return {
    update: (v: any) => { calls.push(["update", v]); return { eq: (c: string, id: string) => { calls.push(["eq", c, id]); return { select: async () => ({ data: [{ id }], error: null }) }; } }; },
    delete: () => { calls.push(["delete"]); throw new Error("delete niet toegestaan"); },
  }; } };
  return { db, calls };
}

describe("ArchiveProjectAction", () => {
  it("annuleren roept niets aan", () => {
    const on = vi.fn();
    render(<ArchiveProjectAction title="Amsterdam — overleg burgemeester" archived={false} onSetArchived={on} />);
    fireEvent.click(screen.getByRole("button", { name: "Verwijderen uit overzicht" }));
    expect(screen.getByText(/"Amsterdam — overleg burgemeester" verwijderen uit overzicht\?/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Annuleren" }));
    expect(on).not.toHaveBeenCalled();
  });
  it("bevestigen archiveert; bij fout blijft dialoog open met melding", async () => {
    const on = vi.fn().mockRejectedValue(new Error("Geen toegang"));
    render(<ArchiveProjectAction title="P" archived={false} onSetArchived={on} />);
    fireEvent.click(screen.getByRole("button", { name: "Verwijderen uit overzicht" }));
    const confirm = screen.getAllByRole("button", { name: "Verwijderen uit overzicht" }).at(-1)!;
    fireEvent.click(confirm);
    expect(on).toHaveBeenCalledWith(true);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Geen toegang"));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });
  it("uitgeschakeld tijdens bewerken", () => {
    render(<ArchiveProjectAction title="P" archived={false} disabled onSetArchived={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Verwijderen uit overzicht" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("terugzetten roept aan met false", () => {
    const on = vi.fn().mockResolvedValue(undefined);
    render(<ArchiveProjectAction title="P" archived onSetArchived={on} />);
    fireEvent.click(screen.getByRole("button", { name: "Terugzetten" }));
    expect(on).toHaveBeenCalledWith(false);
  });
});

describe("setProjectArchived", () => {
  it("archiveert exact dit project, alleen archived_at, geen delete", async () => {
    const { db, calls } = fakeDb();
    await setProjectArchived(db, PID, true, () => "2026-10-14T20:00:00.000Z");
    expect(calls).toEqual([["from", "internal_projects"], ["update", { archived_at: "2026-10-14T20:00:00.000Z" }], ["eq", "id", PID]]);
  });
  it("terugzetten zet alleen archived_at op null", async () => {
    const { db, calls } = fakeDb();
    await setProjectArchived(db, PID, false);
    expect(calls[1]).toEqual(["update", { archived_at: null }]);
    expect(calls.some((c) => c[0] === "delete")).toBe(false);
  });
});

describe("ledenweergave blijft alleen-lezen", () => {
  it("MemberProjectsView bevat geen archiveer-/schrijfacties", () => {
    const src = readFileSync("src/components/projecten/MemberProjectsView.tsx", "utf8");
    expect(src).not.toMatch(/ArchiveProjectAction|setProjectArchived|\.from\(|\.update\(|\.insert\(|\.delete\(\)/);
  });
});
