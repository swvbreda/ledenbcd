// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => {
  const q: any = { select: () => q, is: () => q, gte: () => q, lte: () => q, order: () => q, then: (cb: any) => cb({ data: [] }) };
  return { supabase: { from: () => q, functions: { invoke: vi.fn() }, storage: { from: () => ({}) } } };
});
vi.mock("@/hooks/useInternalDeclarations", () => ({ useDeclarationSyncErrors: () => ({ data: {} }) }));

import InternalDeclarationsView from "../InternalDeclarationsView";

const base = { year: 2026, board_member_name: "Simone", board_member_id: "b1", declaration_type: "reiskosten", appointment: "x", trajectory: null,
  km_single: null, km_return: null, km_rate: 0.23, expense_date: "2026-10-01", bank_account: null, account_holder: null, max_allowance_note: null,
  reviewed_by: null, reviewed_at: null, paid_at: null, bank_transaction_id: null, receipt_path: null, informer_status: "sent", informer_external_id: null, informer_synced_at: null };
const decls: any[] = [
  { ...base, id: "1", amount: 18.17, status: "pending", submitted_by: "u1" },
  { ...base, id: "2", amount: 10, status: "approved", submitted_by: "u1", informer_status: "error" },
  { ...base, id: "3", amount: 50, status: "approved", submitted_by: "u1", paid_at: "2026-10-02" },
  { ...base, id: "4", amount: 99, status: "pending", submitted_by: "u2", board_member_name: "Bernard", board_member_id: "b2" },
];
const noop = () => {};
const renderView = (isAdmin = false) => render(<InternalDeclarationsView declarations={decls} boardMembers={[]} year={2026} isAdmin={isAdmin}
  userId="u1" onAdd={vi.fn()} onDelete={noop} onApprove={noop} onReject={noop} />);

afterEach(cleanup);

describe("InternalDeclarationsView open totaal", () => {
  it("toont gewone gebruiker eigen open totaal vóór indienen, zonder betaalde of andermans declaraties", () => {
    renderView(false);
    const block = screen.getByRole("region", { name: "Openstaand totaal" });
    expect(within(block).getByText(/2 declaraties/)).toBeTruthy();
    expect(block.textContent).toMatch(/28,17/);
    expect(screen.getByRole("button", { name: /Nieuwe aparte declaratie/ })).toBeTruthy();
  });

  it("houdt totaal zichtbaar terwijl het formulier open is en wist invulling niet bij opnieuw klikken", () => {
    renderView(false);
    fireEvent.click(screen.getByRole("button", { name: /Nieuwe aparte declaratie/ }));
    const form = screen.getByRole("region", { name: "Nieuwe declaratie" });
    expect(within(form).getByTestId("form-open-total").textContent).toMatch(/2 open declaraties/);
    expect(screen.getByRole("region", { name: "Openstaand totaal" })).toBeTruthy();
    const desc = within(form).getByPlaceholderText(/bestuursvergadering/) as HTMLInputElement;
    fireEvent.change(desc, { target: { value: "Vergadering Utrecht" } });
    fireEvent.click(screen.getByRole("button", { name: /Nieuwe aparte declaratie/ }));
    expect(screen.getByRole("region", { name: "Nieuwe declaratie" })).toBeTruthy();
    expect((screen.getByPlaceholderText(/bestuursvergadering/) as HTMLInputElement).value).toBe("Vergadering Utrecht");
  });

  it("admin ziet alle open declaraties en per bestuurder", () => {
    renderView(true);
    const block = screen.getByRole("region", { name: "Openstaand totaal" });
    expect(within(block).getByText(/3 declaraties/)).toBeTruthy();
    expect(within(block).getByText(/Bernard/)).toBeTruthy();
  });
});
