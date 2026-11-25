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
    { name: "Kantoorkosten", budgeted: 10500, actual2026: 3694.51, basis: "Kantoorartikelen € 4.500 (planningsbudget, niet onderbouwd) + kantoorhuur € 6.000. Huurcontract Officez/BCD: € 400 per maand excl. btw, servicekosten inbegrepen; eerste jaarlijkse aanpassing 1 september 2027, minimaal 2%. Facturen 60.03.01097 en 60.03.01043 bevestigen € 400 + € 84 btw = € 484 (het contracttotaal van € 485 wijkt rekenkundig af). Zonder btw-aftrek minimaal 8 × € 484 + 4 × € 493,68 = € 5.846,72; de werkelijke indexering kan hoger zijn. De € 6.000 laat € 153,28 ruimte, geen definitieve geïndexeerde huur. Waarborgsom is geen kosten." },
    { name: "Vergaderkosten", budgeted: 25500, actual2026: 22800.81, basis: "Planningsbudget voor een volledig jaar." },
    { name: "ICT / Hosting / Domein / Mail", budgeted: 7000, actual2026: 5864, basis: "Planningsbudget; bestaande toerekening behouden, geen andere boekingen verschoven." },
    { name: "Bankkosten", budgeted: 400, actual2026: 324.88, basis: "Afgerond op de huidige kosten." },
    { name: "Contributies (kosten)", budgeted: 500, actual2026: 418.11, basis: "Afgerond op de huidige kosten." },
    { name: "Representatiekosten", budgeted: 3000, actual2026: 2341.40, basis: "Afgerond op de huidige kosten." },
    { name: "Reiskosten", budgeted: 3500, actual2026: 2719.26, basis: "Afgerond op de huidige kosten." },
  ] },
  { name: "Dagelijks bestuur", lines: [
    { name: "Voorzitter - Het Strategiebureau", budgeted: 101000, actual2026: null, basis: "Planningsraming op basis van 2026-bronnen, geen bevestigde loonberekening 2027. In 2027 vervangt loondienst de eerdere kosten als opdrachtnemer; eerdere facturen en salaris niet bij elkaar optellen. Salaris: bruto € 6.760 per maand × 12 = € 81.120 + 8% vakantiegeld € 6.489,60 = € 87.609,60 per jaar (arbeidsovereenkomst 2026, loonstrook oktober). Werkgeverspremies: volgens de originele loonaangifte oktober 2026 (e-mail Daan Kottmann, 'Loonheffingen BCD', 21 november 2026 10:10) werknemersverzekeringen € 710 + werkgeversheffing Zvw € 403 = € 1.113 per maand, in afgeronde aangifte-euro's; × 12 = € 13.356 per jaar. Samen € 100.965,60 op niveau 2026, afgerond begroot € 101.000. Eenvoudige jaarberekening: het premieloon in de aangifte is gemaximeerd op € 6.617 tegenover € 6.760 bruto; er zijn geen extra premies over vakantiegeld bijgeteld. Ingehouden loonheffing (€ 2.225) en nettoloon zijn onderdelen van het brutosalaris en worden niet nogmaals boven op het brutosalaris geteld. Nog niet bevestigd: tarieven en maxima 2027 (incl. Whk) en overige kosten zoals pensioen, arbodienst, verzuimverzekering en salarisadministratie; die zijn niet geraamd en niet als nul aangenomen. De werknemer valt volgens het contract buiten de verplichte pensioenregeling." },
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

/** Onderbouwd jaarsalaris uit de arbeidsovereenkomst: 12 × bruto + 8% vakantiegeld. */
export function jaarsalarisInclVakantiegeld(brutoPerMaand: number): number {
  return Math.round(brutoPerMaand * 12 * 1.08 * 100) / 100;
}

/** Minimale huur 2027 incl. niet-aftrekbare btw: jan–aug huidig, sep–dec minimaal 2% hoger. */
export function minimaleHuur2027(maandInclBtw: number): number {
  return Math.round((8 * maandInclBtw + 4 * Math.round(maandInclBtw * 1.02 * 100) / 100) * 100) / 100;
}

export const WERKGEVER_WAARSCHUWING = "Loonbudget €101.000: raming op basis van de loonaangifte oktober 2026 (€100.965,60 op jaarbasis). Tarieven 2027 en overige personeelskosten nog te bevestigen.";

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
  werkgeverWaarschuwing: string;
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
    werkgeverWaarschuwing: WERKGEVER_WAARSCHUWING,
    uitgaven: UITGAVEN_2027.map((c) => ({ name: c.name, lines: c.lines.map((l) => ({ ...l })) })),
    inkomsten: [
      { name: "Contributies", budgeted: BEGROTING_2027.totalFull, actual2026: null, basis: "Scenario volledige staffel (niet vastgesteld). Alternatief 50% van de verhoging: € 382.750." },
      { name: "Donaties en overige baten", budgeted: 0, actual2026: null, basis: "Niet bevestigd; daarom niet geraamd." },
    ],
  };
}
