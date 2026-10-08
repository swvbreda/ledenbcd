// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
vi.setConfig({ testTimeout: 20000 });
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => {
  const q: any = { select: () => q, not: () => q, or: () => q, limit: () => q, eq: () => q, is: () => q, gte: () => q, lte: () => q, order: () => q, then: (cb: any) => cb({ data: [] }) };
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
const members: any[] = [{ id: "b1", naam: "Simone", functie: null, prive_adres: null, prive_postcode: null, prive_plaats: null }, { id: "b2", naam: "Bernard", functie: null, prive_adres: null, prive_postcode: null, prive_plaats: null }];
const renderView = (isAdmin = false) => render(<InternalDeclarationsView declarations={decls} boardMembers={members} year={2026} isAdmin={isAdmin}
  userId="u1" onAdd={vi.fn()} onDelete={noop} onApprove={noop} onReject={noop} />);

afterEach(cleanup);
Object.assign(Element.prototype, { hasPointerCapture: () => false, releasePointerCapture: () => {}, setPointerCapture: () => {}, scrollIntoView: () => {} });
async function pickMember(name: string) {
  const form = screen.getByRole("region", { name: "Nieuwe declaratie" });
  const trigger = within(form).getAllByRole("combobox")[0];
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
  console.log("T open"); const listbox = await screen.findByRole("listbox"); console.log("T listbox");
  const opt = [...listbox.querySelectorAll('[role="option"]')].find((o) => o.textContent?.startsWith(name))!;
  fireEvent.click(opt); console.log("T clicked");
}
const noteIsBelowFormFields = () => {
  const form = screen.getByRole("region", { name: "Nieuwe declaratie" });
  const note = within(form).getByTestId("form-open-total");
  const submit = within(form).getByRole("button", { name: "Declaratie definitief indienen" });
  const bon = within(form).getByText(/^Bon/);
  expect(bon.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(note.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  return note;
};

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
    expect(noteIsBelowFormFields().textContent).toMatch(/2 open declaraties \(.*28,17\)/);
    expect(within(form).getAllByTestId("form-open-total")).toHaveLength(1);
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

  it("admin: melding onderaan volgt het gekozen bestuurslid, niet het totaal over iedereen", async () => {
    renderView(true);
    fireEvent.click(screen.getByRole("button", { name: /Nieuwe aparte declaratie/ }));
    expect(noteIsBelowFormFields().textContent).toMatch(/3 open declaraties.*over alle bestuurders/);
    await pickMember("Bernard");
    expect(noteIsBelowFormFields().textContent).toMatch(/voor Bernard al 1 open declaratie \(.*99,00\)/);
    await pickMember("Simone");
    expect(noteIsBelowFormFields().textContent).toMatch(/voor Simone al 2 open declaraties \(.*28,17\)/);
  });

  it("gewone gebruiker ziet bij een ander bestuurslid geen cijfers van die ander", async () => {
    renderView(false);
    fireEvent.click(screen.getByRole("button", { name: /Nieuwe aparte declaratie/ }));
    await pickMember("Bernard");
    expect(screen.queryByTestId("form-open-total")).toBeNull();
  });
});
