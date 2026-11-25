// Gedateerde ramingssnapshot (concept) — bewust statisch, géén liveberekening
// en géén koppeling met leden, facturen of de begroting van andere jaren.
export const BEGROTING_2027 = {
  year: 2027,
  peildatum: "25 november 2026",
  staffel: [
    { label: "1 locatie", amount: 3000 },
    { label: "2–3 locaties", amount: 4500 },
    { label: "4–6 locaties", amount: 6000 },
    { label: "7–10 locaties", amount: 8000 },
    { label: "Meer dan 10 locaties", amount: 10000 },
  ],
  rows: [
    { label: "1 locatie", count: 103, amount: 3000 },
    { label: "2–3 locaties", count: 11, amount: 4500 },
    { label: "4–6 locaties", count: 6, amount: 6000 },
    { label: "7–10 locaties", count: 1, amount: 8000 },
  ],
  /** Snapshotwaarden zoals aangeleverd; tests controleren dat ze kloppen met de tabel. */
  totalFull: 402500,
  totalHalf: 382750,
  totalGroups: 121,
} as const;

export const BASE_CONTRIBUTION = 3000;

export function scenarioTotals(rows: readonly { count: number; amount: number }[]) {
  const full = rows.reduce((s, r) => s + r.count * r.amount, 0);
  const base = rows.reduce((s, r) => s + r.count * BASE_CONTRIBUTION, 0);
  const groups = rows.reduce((s, r) => s + r.count, 0);
  return { full, half: base + (full - base) / 2, groups };
}

export const CONTROLEPUNTEN: string[] = [
  "Tyson: uitgesloten; bedrag wacht nog op bevestiging.",
  "Baba en Demo: uitgesloten.",
  "Scolo: alleen bij GOA meegerekend in plaats van apart plus GOA — groepering controleren.",
  "The Plug: 6 unieke locaties aangenomen in plaats van 7 (Eerste/1e Oosterparkstraat 47). Zonder deze aanname +€ 2.000.",
  "Hunters: 9 actuele locaties in plaats van het oude aantal 11. Indien 11: +€ 2.000.",
  "Coffeeshop 010: 5 locaties, waarvan 3 zonder adres. Bij 2 locaties: −€ 1.500.",
  "Ballonnetje, Noon en Prix d'Ami: nu afzonderlijk gerekend. Als één groep van 3: −€ 4.500.",
  "Vier voorlopige Hilversumse leden: wel meegenomen (€ 12.000) voor 2027 volgens notities; formulieren nog nodig.",
  "Vrijstelling Alien en bijzondere 2026-afspraak Bull: niet automatisch verlengd.",
];

export type ConceptLine = { name: string; budgeted: number; actual2026: number | null; basis: string };
export type ConceptCategory = { name: string; lines: ConceptLine[] };

/** Voorgestelde ramingen (geen bevestigde contracten), volgorde en namen gelijk aan de 2026-begroting. */
export const UITGAVEN_2027: ConceptCategory[] = [
  { name: "Algemene kosten", lines: [
    { name: "Administratiekosten / accountantskosten", budgeted: 5500, actual2026: 4747.30, basis: "Afgeronde werkbudgetraming voor een volledig jaar." },
    { name: "Kantoorkosten", budgeted: 10500, actual2026: 3694.51, basis: "Kantoorartikelen € 4.500 + kantoorhuur € 6.000. Huur op basis van kantoorfactuur van € 484; voorlopig aangenomen dat dit een maandbedrag is (12 × € 484 = € 5.808, afgerond € 6.000), uitgaande van een volledig jaar. Factuurperiode en overlap met bestaande kantoorkosten nog controleren." },
    { name: "Vergaderkosten", budgeted: 25500, actual2026: 22800.81, basis: "Planningsbudget voor een volledig jaar." },
    { name: "ICT / Hosting / Domein / Mail", budgeted: 7000, actual2026: 5864, basis: "Planningsbudget; bestaande toerekening behouden, geen andere boekingen verschoven." },
    { name: "Bankkosten", budgeted: 400, actual2026: 324.88, basis: "Afgerond op de huidige kosten." },
    { name: "Contributies (kosten)", budgeted: 500, actual2026: 418.11, basis: "Afgerond op de huidige kosten." },
    { name: "Representatiekosten", budgeted: 3000, actual2026: 2341.40, basis: "Afgerond op de huidige kosten." },
    { name: "Reiskosten", budgeted: 3500, actual2026: 2719.26, basis: "Afgerond op de huidige kosten." },
  ] },
  { name: "Dagelijks bestuur", lines: [
    { name: "Voorzitter - Het Strategiebureau", budgeted: 98000, actual2026: null, basis: "Voorlopige begrotingsruimte overgenomen uit 2026 in verband met loondienst in 2027. Geen gevalideerde totale loonkosten: definitieve werkgeverslasten, pensioen en vakantiegeldreservering ontbreken nog. Eerdere facturen en salaris niet bij elkaar optellen." },
    { name: "Secretariaatskosten", budgeted: 20000, actual2026: null, basis: "Bestaand gepland budget behouden; geen bevestigde afspraak. Overlap met taken uit het dienstverband controleren." },
    { name: "Ondersteuning", budgeted: 10000, actual2026: 8719.73, basis: "Planningsbudget." },
    { name: "Onkosten vergoedingen", budgeted: 5000, actual2026: 4410, basis: "Planningsbudget." },
  ] },
  { name: "Advieskosten", lines: [
    { name: "Juridische kosten / bestuurlijk advies", budgeted: 150000, actual2026: null, basis: "Eerder jaarlijks beleidsbudget behouden, geen doorgetrokken historische kosten. Dossierplan en verwachte PCN-terugbetalingen nog niet bevestigd." },
    { name: "Juridische kosten / bestuurlijk advies (2025)", budgeted: 0, actual2026: null, basis: "Regel behouden voor herkenbare opbouw. Het meegenomen bedrag van € 42.196 is in 2026 opgebruikt en wordt niet opnieuw meegenomen." },
    { name: "Onderzoek", budgeted: 50000, actual2026: null, basis: "Eerder beleidsbudget; geen bevestigde verplichtingen." },
    { name: "Communicatie / marketing", budgeted: 10000, actual2026: 8849.26, basis: "Planningsbudget." },
    { name: "Drukwerk", budgeted: 1500, actual2026: 952.69, basis: "Planningsbudget." },
    { name: "Verzendkosten", budgeted: 2000, actual2026: null, basis: "Eerder beleidsbudget behouden." },
  ] },
  { name: "Donaties", lines: [
    { name: "Donatie Stg. Maatschappij en cannabis", budgeted: 3000, actual2026: null, basis: "Gepland plafond behouden; geen toezegging voor 2027." },
    { name: "Donatie Stg VOC", budgeted: 2000, actual2026: null, basis: "Gepland plafond behouden; geen toezegging voor 2027." },
    { name: "Donatie overige", budgeted: 1000, actual2026: null, basis: "Gepland plafond behouden; geen toezegging voor 2027." },
  ] },
];

export function conceptTotals(cats: readonly ConceptCategory[], incomeFull: number, incomeHalf: number) {
  const perCategory = cats.map((c) => ({ name: c.name, total: c.lines.reduce((s, l) => s + l.budgeted, 0) }));
  const expenses = perCategory.reduce((s, c) => s + c.total, 0);
  return { perCategory, expenses, resultFull: incomeFull - expenses, resultHalf: incomeHalf - expenses };
}

export type Begroting2027Snapshot = {
  uitgaven: ConceptCategory[];
  inkomsten: ConceptLine[];
  peildatum: string;
  staffel: { label: string; amount: number }[];
  rows: { label: string; count: number; amount: number }[];
  totalFull: number;
  totalHalf: number;
  totalGroups: number;
  controlepunten: string[];
};

type RoleClient = { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: unknown; error: unknown }> };

/** Alleen een beheerder (has_role onder de eigen sessie/RLS) krijgt de snapshot. */
export async function begroting2027ForCaller(client: RoleClient, userId: string): Promise<Begroting2027Snapshot> {
  const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("Geen rechten");
  return {
    peildatum: BEGROTING_2027.peildatum,
    staffel: BEGROTING_2027.staffel.map((s) => ({ ...s })),
    rows: BEGROTING_2027.rows.map((r) => ({ ...r })),
    totalFull: BEGROTING_2027.totalFull,
    totalHalf: BEGROTING_2027.totalHalf,
    totalGroups: BEGROTING_2027.totalGroups,
    controlepunten: [...CONTROLEPUNTEN],
    uitgaven: UITGAVEN_2027.map((c) => ({ name: c.name, lines: c.lines.map((l) => ({ ...l })) })),
    inkomsten: [
      { name: "Contributies", budgeted: BEGROTING_2027.totalFull, actual2026: null, basis: "Scenario volledige staffel (niet vastgesteld). Alternatief 50% van de verhoging: € 382.750." },
      { name: "Donaties en overige baten", budgeted: 0, actual2026: null, basis: "Niet bevestigd; daarom niet geraamd." },
    ],
  };
}
