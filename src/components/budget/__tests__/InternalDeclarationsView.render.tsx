// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
vi.setConfig({ testTimeout: 20000 });
import { render, screen, fireEvent, cleanup, within, waitFor } from "@testing-library/react";

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
  { ...base, id: "4", amount: 99, status: "pending", submitted_by: "u2", board_member_name: "Bernard", board_member_id: "b2", appointment: "Bernard reis" },
  { ...base, id: "5", amount: 7, status: "concept", submitted_by: "u1", appointment: "concept-x" },
  { ...base, id: "6", amount: 8, status: "rejected", submitted_by: "u1", appointment: "afgewezen-x" },
  { ...base, id: "7", amount: 9, status: "pending", submitted_by: "u1", year: 2025, appointment: "vorig-jaar-x" },
];
const noop = () => {};
const members: any[] = [{ id: "b1", naam: "Simone", functie: null, prive_adres: null, prive_postcode: null, prive_plaats: null }, { id: "b2", naam: "Bernard", functie: null, prive_adres: null, prive_postcode: null, prive_plaats: null }];
const renderView = (isAdmin = false) => render(<InternalDeclarationsView declarations={decls} boardMembers={members} year={2026} isAdmin={isAdmin}
  userId="u1" onAdd={vi.fn()} onDelete={noop} onApprove={noop} onReject={noop} />);

afterEach(cleanup);
Object.assign(Element.prototype, { hasPointerCapture: () => false, releasePointerCapture: () => {}, setPointerCapture: () => {}, scrollIntoView: () => {} });
async function pickMember(name: string) {
  const form = document.querySelector<HTMLElement>('section[aria-label="Nieuwe declaratie"]')!;
  const trigger = form.querySelector<HTMLElement>('[role="combobox"]')!;
  trigger.focus();
  fireEvent.keyDown(trigger, { key: "Enter" });
  const listbox = await waitFor(() => { const l = document.querySelector<HTMLElement>('[role="listbox"]'); if (!l) throw new Error("geen lijst"); return l; });
  const opt = [...listbox.querySelectorAll('[role="option"]')].find((o) => o.textContent?.startsWith(name))!;
  fireEvent.click(opt);
}
const noteIsBelowFormFields = () => {
  const form = document.querySelector<HTMLElement>('section[aria-label="Nieuwe declaratie"]')!;
  const note = within(form).getByTestId("form-open-total");
  const submit = within(form).getByText("Declaratie definitief indienen");
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

  it("admin: algemene melding onderaan noemt alle bestuurders, geen persoonlijke claim", () => {
    renderView(true);
    fireEvent.click(screen.getByRole("button", { name: /Nieuwe aparte declaratie/ }));
    const t = noteIsBelowFormFields().textContent!;
    expect(t).toMatch(/3 open declaraties.*over alle bestuurders/);
    expect(t).not.toMatch(/Je hebt/);
  });

  const drillTexts = () => [...document.querySelectorAll('[data-testid="drill-list"] li')].map((li) => li.textContent);

  it("admin klikt bestuurder: exact diens open declaraties en som", async () => {
    renderView(true);
    fireEvent.click(screen.getByRole("button", { name: "Bekijk openstaande declaraties van Bernard" }));
    await waitFor(() => expect(document.querySelector('[data-testid="drill-summary"]')).toBeTruthy());
    expect(document.querySelector('[data-testid="drill-summary"]')!.textContent).toMatch(/1 declaratie · €\s?99,00/);
    expect(drillTexts()).toHaveLength(1);
    expect(drillTexts()[0]).toMatch(/Bernard reis/);
  });

  it("totaal klikken toont alle open records, zonder concept/afgewezen/betaald/ander jaar, ook met zoekfilter", async () => {
    renderView(true);
    fireEvent.change(screen.getByPlaceholderText("Zoek in declaraties…"), { target: { value: "bestaat-niet" } });
    fireEvent.click(screen.getByRole("button", { name: "Bekijk openstaande declaraties" }));
    await waitFor(() => expect(document.querySelector('[data-testid="drill-summary"]')).toBeTruthy());
    expect(document.querySelector('[data-testid="drill-summary"]')!.textContent).toMatch(/3 declaraties · €\s?127,17/);
    const all = drillTexts().join("|");
    expect(all).not.toMatch(/concept-x|afgewezen-x|vorig-jaar-x/);
    expect(drillTexts()).toHaveLength(3);
  });

  it("gewone gebruiker ziet alleen eigen open records en formulier blijft ingevuld na sluiten", async () => {
    renderView(false);
    fireEvent.click(screen.getByRole("button", { name: /Nieuwe aparte declaratie/ }));
    fireEvent.change(screen.getByPlaceholderText(/bestuursvergadering/), { target: { value: "Behouden tekst" } });
    fireEvent.click(screen.getByRole("button", { name: "Bekijk openstaande declaraties" }));
    await waitFor(() => expect(document.querySelector('[data-testid="drill-summary"]')).toBeTruthy());
    expect(document.querySelector('[data-testid="drill-summary"]')!.textContent).toMatch(/2 declaraties · €\s?28,17/);
    expect(drillTexts().join("|")).not.toMatch(/Bernard/);
    fireEvent.keyDown(document.activeElement || document.body, { key: "Escape" });
    await waitFor(() => expect(document.querySelector('[data-testid="drill-summary"]')).toBeNull());
    expect((screen.getByPlaceholderText(/bestuursvergadering/) as HTMLInputElement).value).toBe("Behouden tekst");
  });
});
