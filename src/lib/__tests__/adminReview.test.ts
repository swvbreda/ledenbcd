import { describe, expect, it } from "vitest";
import { closedYearsFromAttempts, contributionsToReview, declarationsToReview, ledgerExceptions, countWithoutDossier } from "../adminReview";

describe("adminReview (alleen lezen)", () => {
  it("contributie: alleen betaald, zonder factuur én zonder bankdossier met lidnummer", () => {
    const rows = [
      { id: "1", member_id: 5, year: 2026, amount: 3000, paid: true, external_invoice_id: null },
      { id: "2", member_id: 6, year: 2026, amount: 3000, paid: true, external_invoice_id: null },
      { id: "3", member_id: 7, year: 2026, amount: 3000, paid: true, external_invoice_id: "INV" },
      { id: "4", member_id: 8, year: 2026, amount: 3000, paid: false, external_invoice_id: null },
    ];
    const r = contributionsToReview(rows, [{ dossier: "Contributie Shop (#6)", year: 2026, incoming: true }, { dossier: "Contributie (#5)", year: 2025, incoming: true }, { dossier: "Terugbetaling (#5)", year: 2026, incoming: false }], new Map([[5, "Shop A"]]), 2026);
    expect(r.map((x) => x.member_id)).toEqual([5]);
    expect(r[0].name).toBe("Shop A");
  });
  it("afwijkende eerdere post wordt getoond, niet bij handmatige post of gelijke post", () => {
    const rows = [
      { informer_id: "a", ledger_account: "4340 Advieskosten", amount_incl: 630, relation_name: "X", entry_date: "2026-03-01" },
      { informer_id: "b", ledger_account: "4340 Advieskosten", amount_incl: 1, relation_name: null, entry_date: null },
      { informer_id: "c", ledger_account: "4340 Advieskosten", amount_incl: 1, relation_name: null, entry_date: null },
    ];
    const ex = ledgerExceptions(rows, new Map([["c", "li"]]), new Map([["a", { id: "o", name: "Ondersteuning" }], ["b", { id: "j", name: "Juridische kosten / bestuurlijk advies (incl. restbudget 2025)" }]]), new Map([["a", "Lobby"]]), new Map([["li", "Iets"]]));
    expect(ex.map((e) => e.informer_id)).toEqual(["a", "c"]);
    expect(ex[0]).toMatchObject({ currentPost: "Ondersteuning", currentPostId: "o", manual: false, dossier: "Lobby" });
    expect(ex[1]).toMatchObject({ currentPost: "Iets", manual: true });
  });
  it("gesloten jaren alleen uit echte Informer-weigering", () => {
    expect(closedYearsFromAttempts([{ sanitized_error: "Inkoopfactuur aanmaken mislukt: You can no longer book in the specified period.", year: 2025 }, { sanitized_error: "422", year: 2026 }])).toEqual([2025]);
  });
  it("declaraties: €0, verzendfout, gesloten jaar en zonder post; afgewezen genegeerd", () => {
    const base = { status: "approved", informer_status: "not_sent", year: 2026, expense_date: "2026-01-01", board_member_name: "B", budget_line_item_id: "p", dossier: null };
    const r = declarationsToReview([
      { ...base, id: "z", amount: 0 }, { ...base, id: "e", amount: 85.56, informer_status: "error" },
      { ...base, id: "y", amount: 210, year: 2025 }, { ...base, id: "x", amount: 1, status: "rejected", budget_line_item_id: null },
    ], [2025]);
    expect(r.map((x) => x.id)).toEqual(["z", "e", "y"]);
    expect(countWithoutDossier([{ ...base, id: "z", amount: 0 }, { ...base, id: "d", amount: 1, dossier: "Worldline" }])).toBe(1);
  });
});

import { contributionEvidence, declYearMismatch } from "../adminReview";
describe("contributie-bankbewijs", () => {
  const c = (id: string, m: number) => ({ id, member_id: m, year: 2026, amount: 3000, paid: true, external_invoice_id: null });
  const b = (id: string, amount: number, dossier: string, year = 2026, extra = {}) => ({ id, amount, year, dossier, ...extra });
  it("alleen vastgelegde unieke exacte koppeling is bewezen; overige uitzonderingen", () => {
    const r = contributionEvidence(
      [c("e", 1), c("o", 2), c("p", 3), c("m", 4), c("n", 5), c("x", 6), c("y", 7)],
      [b("b1", 3000, "(#1)"), b("b2", 3000, "(#2)"), b("b3", 3000, "(#2)"), b("b4", 1334.9, "(#3)"), b("b5", 3000, "(#4) (#9)"),
       b("b6", 3000, "(#5)"), b("b7", 3000, "(#6)", 2025), b("b8", 3000, "(#7)", 2026, { declLinked: true })],
      [{ contribution_id: "e", bank_transaction_id: "b1" }], 2026);
    expect(r.linked.map((x) => x.contribution_id)).toEqual(["e"]);
    const why = Object.fromEntries(r.exceptions.map((x) => [x.contribution_id, x.reason]));
    expect(why.o).toMatch(/Overbetaling/); expect(why.p).toMatch(/Gedeeltelijk/); expect(why.m).toMatch(/meerdere leden/);
    expect(why.n).toMatch(/zonder vastgelegde/); expect(why.y).toMatch(/ander document/); expect(why.x).toBeUndefined();
  });
  it("koppeling naar verkeerde ontvangst of afwijkend bedrag is niet bewezen", () => {
    const r = contributionEvidence([c("e", 1)], [b("b1", 2999, "(#1)")], [{ contribution_id: "e", bank_transaction_id: "b1" }], 2026);
    expect(r.linked).toHaveLength(0);
  });
  it("jaarafwijking €85,56", () => {
    expect(declYearMismatch({ id: "a", amount: 85.56, status: "approved", informer_status: "error", year: 2026, expense_date: "2025-01-01", board_member_name: null })).toBe(true);
  });
});
