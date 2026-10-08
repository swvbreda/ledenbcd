import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
afterEach(cleanup);
vi.mock("@/lib/invokeFunction", () => ({ invokeWithAuth: vi.fn() }));
import PaidPreflightPanel from "../PaidPreflightPanel";

const decls = [
  { id: "a", amount: 210, expense_date: "2026-05-31", board_member_name: "Bernard", status: "approved", budget_line_item_id: "p" },
  { id: "b", amount: 210, expense_date: "2026-06-30", board_member_name: "Joachim", status: "approved", budget_line_item_id: null },
];

describe("PaidPreflightPanel", () => {
  it("roept alleen de alleen-lezen controle aan en toont status per record", async () => {
    const invoke = vi.fn(async () => ({ data: { success: true, checked_purchases: 40, rows: [
      { declaration_id: "a", reference: "DECL-A", status: "klaar_voor_handmatige_aflettering" },
      { declaration_id: "b", reference: "DECL-B", status: "geen_bankbewijs" }] }, error: null }));
    render(<PaidPreflightPanel declarations={decls} invoke={invoke as any} />);
    fireEvent.click(screen.getByRole("button", { name: "Controleer betaalde declaraties in Informer" }));
    await waitFor(() => screen.getByTestId("preflight-result"));
    expect(invoke).toHaveBeenCalledTimes(1);
    expect((invoke.mock.calls[0] as any)[0]).toBe("informer-sync?action=paid_declarations_preflight");
    expect(screen.getByText(/40 inkoopfacturen/)).toBeTruthy();
    expect(screen.getAllByText("Klaar voor handmatige aflettering").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bankbewijs ontbreekt").length).toBeGreaterThan(0);
    expect(screen.getByText(/Nog in te delen \(1\)/)).toBeTruthy();
  });
  it("toont veilige fout bij geen toegang, zonder resultaat", async () => {
    const invoke = vi.fn(async () => ({ data: null, error: { message: "403 Forbidden" } }));
    render(<PaidPreflightPanel declarations={decls} invoke={invoke as any} />);
    fireEvent.click(screen.getByRole("button", { name: "Controleer betaalde declaraties in Informer" }));
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByRole("alert").textContent).toContain("Alleen beheerders");
    expect(screen.queryByTestId("preflight-result")).toBeNull();
  });
});
