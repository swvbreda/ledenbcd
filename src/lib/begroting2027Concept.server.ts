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
    { label: "1 locatie", count: 104, amount: 3000 },
    { label: "2–3 locaties", count: 11, amount: 4500 },
    { label: "4–6 locaties", count: 6, amount: 6000 },
    { label: "7–10 locaties", count: 0, amount: 8000 },
    { label: "Meer dan 10 locaties", count: 1, amount: 10000 },
  ],
  /** Snapshotwaarden zoals aangeleverd; tests controleren dat ze kloppen met de tabel. */
  totalFull: 407500,
  totalHalf: 383750,
  totalGroups: 122,
} as const;

export const BASE_CONTRIBUTION = 3000;

export function scenarioTotals(rows: readonly { count: number; amount: number }[]) {
  const full = rows.reduce((s, r) => s + r.count * r.amount, 0);
  const base = rows.reduce((s, r) => s + r.count * BASE_CONTRIBUTION, 0);
  const groups = rows.reduce((s, r) => s + r.count, 0);
  return { full, half: base + (full - base) / 2, groups };
}

/** Groepen met meerdere shops uit de ramingssnapshot van 25 november 2026 (lid-ID, naam, aantal shops). Deels voorlopige indeling. */
export const MEERDERE_SHOPS_2027: { id: number; name: string; shops: number; minimum?: boolean }[] = [
  { id: 1, name: "The Bulldog", shops: 5 }, { id: 5, name: "Green House", shops: 5 }, { id: 8, name: "Coffeeshop Relax", shops: 2 },
  { id: 9, name: "Boere Jongens", shops: 4 }, { id: 20, name: "Easy Times", shops: 2 }, { id: 21, name: "Hunters", shops: 13 },
  { id: 30, name: "Siberië", shops: 5 }, { id: 35, name: "Dampkring The Original", shops: 2 }, { id: 57, name: "Kadinsky", shops: 3 },
  { id: 60, name: "7th heaven", shops: 2 }, { id: 62, name: "Terps Army", shops: 2 }, { id: 66, name: "The Plug", shops: 6 },
  { id: 67, name: "Taffne", shops: 2 }, { id: 86, name: "Coffeeshop Aarden", shops: 3 }, { id: 99, name: "NCC Power Flower", shops: 2 },
  { id: 117, name: "Coffeeshop 010 B.V.", shops: 5 }, { id: 119, name: "Out of time", shops: 2 },   { id: 144, name: "Tyson", shops: 2 }, // voorlopig 2 coffeeshops volgens bevestiging 25-11-2026; geen factuur
];

/**
 * Alle 122 geraamde leden/groepen (alleen lid-ID, zakelijke naam, shops), afgeleid op 25 november 2026 uit de 125 actuele leden
 * met de bevestigde correcties (Hunters 13, Tyson 2, GOA 1, Scolo 1 apart, The Plug 6 incl. East) en zonder Baba, Demo en The Plug East.
 * Shops buiten MEERDERE_SHOPS_2027 tellen als 1 volgens de ramingssnapshot. Server-only; geen contactgegevens.
 */
export const RAMINGSLEDEN_2027: { id: number; name: string; shops: number }[] = [
  { id: 1, name: "The Bulldog", shops: 5 },
  { id: 2, name: "Hortus de Overkant", shops: 1 },
  { id: 3, name: "Get Down", shops: 1 },
  { id: 4, name: "Coffeeshop Splif", shops: 1 },
  { id: 5, name: "Greenhouse", shops: 5 },
  { id: 6, name: "Chapiteau", shops: 1 },
  { id: 7, name: "Sensimilla", shops: 1 },
  { id: 8, name: "Coffeeshop Relax", shops: 2 },
  { id: 9, name: "Boere Jongens", shops: 4 },
  { id: 10, name: "Happy Feelings", shops: 1 },
  { id: 11, name: "Abraxas", shops: 1 },
  { id: 12, name: "De Molen", shops: 1 },
  { id: 13, name: "City Hall", shops: 1 },
  { id: 14, name: "Coffeeshop Pink", shops: 1 },
  { id: 15, name: "Koffiehuis Sharon", shops: 1 },
  { id: 16, name: "De Os", shops: 1 },
  { id: 17, name: "Superfly", shops: 1 },
  { id: 18, name: "The Corner", shops: 1 },
  { id: 20, name: "Easy Times", shops: 2 },
  { id: 21, name: "Hunters", shops: 13 },
  { id: 22, name: "De Broers / The Dolphins", shops: 1 },
  { id: 23, name: "Nachtegaal", shops: 1 },
  { id: 24, name: "Het Gelderse", shops: 1 },
  { id: 25, name: "De Kroon Twee", shops: 1 },
  { id: 26, name: "Tuda Fruta", shops: 1 },
  { id: 27, name: "Cremers", shops: 1 },
  { id: 28, name: "Trefpunt", shops: 1 },
  { id: 29, name: "Bronx", shops: 1 },
  { id: 30, name: "Siberië", shops: 5 },
  { id: 31, name: "Yanks", shops: 1 },
  { id: 32, name: "Coffeeshop Scolo", shops: 1 },
  { id: 33, name: "Family First", shops: 1 },
  { id: 34, name: "Blue Bird", shops: 1 },
  { id: 35, name: "Dampkring The Original", shops: 2 },
  { id: 37, name: "De Rode Leeuw", shops: 1 },
  { id: 39, name: "Thunderbird", shops: 1 },
  { id: 40, name: "De Ambassade", shops: 1 },
  { id: 41, name: "The Mix", shops: 1 },
  { id: 42, name: "De Kade", shops: 1 },
  { id: 43, name: "Solo", shops: 1 },
  { id: 44, name: "Roundabout 69", shops: 1 },
  { id: 45, name: "Roxanne", shops: 1 },
  { id: 46, name: "The Border", shops: 1 },
  { id: 47, name: "Oya", shops: 1 },
  { id: 48, name: "Zero Zero", shops: 1 },
  { id: 49, name: "High Time", shops: 1 },
  { id: 50, name: "New Times", shops: 1 },
  { id: 52, name: "Katsu", shops: 1 },
  { id: 53, name: "Coffee and Dreams", shops: 1 },
  { id: 54, name: "Reefer", shops: 1 },
  { id: 55, name: "Kashmir", shops: 1 },
  { id: 56, name: "Rock-it", shops: 1 },
  { id: 57, name: "Kadinsky", shops: 3 },
  { id: 60, name: "Coffeeshop 137 / 7th heaven", shops: 2 },
  { id: 62, name: "Terps Army", shops: 2 },
  { id: 63, name: "Coffeeshop Rif Rotterdam", shops: 1 },
  { id: 65, name: "El Marssa", shops: 1 },
  { id: 66, name: "The Plug (Utopia)", shops: 6 },
  { id: 67, name: "Tafne", shops: 2 },
  { id: 69, name: "Bullwacki", shops: 1 },
  { id: 70, name: "Coffeeshop Johnny", shops: 1 },
  { id: 71, name: "Blue Tomato", shops: 1 },
  { id: 72, name: "De Jolly Joker", shops: 1 },
  { id: 73, name: "Coffeeshop Mississippi", shops: 1 },
  { id: 74, name: "Coffeeshop Rokade", shops: 1 },
  { id: 75, name: "Second Cheech & Chong's", shops: 1 },
  { id: 76, name: "Coffeeshop Alien", shops: 1 },
  { id: 77, name: "Voyagers", shops: 1 },
  { id: 78, name: "Ruthless", shops: 1 },
  { id: 79, name: "The Happy Family", shops: 1 },
  { id: 80, name: "Prix d'Ami", shops: 1 },
  { id: 82, name: "Het Ballonnetje", shops: 1 },
  { id: 83, name: "1e Hulp", shops: 1 },
  { id: 84, name: "The Rookies", shops: 1 },
  { id: 85, name: "The Stud", shops: 1 },
  { id: 86, name: "Coffeeshop Aarden", shops: 3 },
  { id: 87, name: "Coffeeshop Smokey", shops: 1 },
  { id: 88, name: "Goa", shops: 1 },
  { id: 89, name: "Funny People", shops: 1 },
  { id: 90, name: "Pleasure", shops: 1 },
  { id: 91, name: "The Bull", shops: 1 },
  { id: 92, name: "Joint Venture", shops: 1 },
  { id: 93, name: "Lucky Luke", shops: 1 },
  { id: 94, name: "Uncle Sam", shops: 1 },
  { id: 95, name: "Happy Smile", shops: 1 },
  { id: 96, name: "Pluto", shops: 1 },
  { id: 97, name: "Piramide", shops: 1 },
  { id: 98, name: "Empire", shops: 1 },
  { id: 99, name: "NCC Power Flower", shops: 2 },
  { id: 100, name: "John & Co", shops: 1 },
  { id: 101, name: "Spirit", shops: 1 },
  { id: 102, name: "High times", shops: 1 },
  { id: 103, name: "De Jungle", shops: 1 },
  { id: 105, name: "De Kronkel", shops: 1 },
  { id: 106, name: "Koffie Rif Hilversum", shops: 1 },
  { id: 107, name: "Club Media", shops: 1 },
  { id: 108, name: "Coffeshop Paradox", shops: 1 },
  { id: 109, name: "Coffeeshop Mediterrané", shops: 1 },
  { id: 110, name: "Grey Area", shops: 1 },
  { id: 112, name: "De Steeg", shops: 1 },
  { id: 113, name: "Coffeeshop Oost", shops: 1 },
  { id: 114, name: "Balou", shops: 1 },
  { id: 115, name: "Koffieshop De Tulp", shops: 1 },
  { id: 116, name: "The Lounge", shops: 1 },
  { id: 117, name: "Coffeeshop 010 B.V.", shops: 5 },
  { id: 119, name: "Out of time", shops: 2 },
  { id: 131, name: "Dr Pleasure", shops: 1 },
  { id: 133, name: "Ying Yang", shops: 1 },
  { id: 134, name: "Flamingo", shops: 1 },
  { id: 135, name: "No Limit", shops: 1 },
  { id: 136, name: "Papillion", shops: 1 },
  { id: 138, name: "Huzur 33", shops: 1 },
  { id: 141, name: "Coffeeshop Relax", shops: 1 },
  { id: 142, name: "Coffeeshop Cobra", shops: 1 },
  { id: 144, name: "Coffeeshop Tyson", shops: 2 },
  { id: 145, name: "De Professor", shops: 1 },
  { id: 146, name: "De Promenade", shops: 1 },
  { id: 147, name: "The Paradise", shops: 1 },
  { id: 148, name: "Galaxy", shops: 1 },
  { id: 149, name: "Koffie en Dromen Almere BV", shops: 1 },
  { id: 150, name: "GOA", shops: 1 },
  { id: 10001, name: "De Loods", shops: 1 },
];

/** Aansluiting binnen de ramingsbron (contributieraming-2027.json, 25 november 2026): 125 registraties, drie niet afzonderlijk geraamd. Niet gelijkgesteld aan het actuele ledendashboard. */
export const LEDENREGISTRATIE_2027 = {
  geregistreerd: 125,
  uitgesloten: [
    { id: 125, name: "Baba", reden: "eerder uitgesloten" },
    { id: 140, name: "Demo", reden: "testrecord" },
    { id: 51, name: "The Plug East", reden: "valt onder groepscontributie The Plug (#66)" },
  ],
} as const;

/** Rekenbrug van geregistreerde coffeeshopvermeldingen (/leden, 25 november 2026) naar vestigingen in ramingsgroepen. */
export const VESTIGINGEN_AANSLUITING_2027 = {
  start: { label: "Geregistreerde coffeeshopvermeldingen (Leden → Coffeeshops)", aantal: 181 },
  stappen: [
    { label: "Vestigingen van 6 leads (Freak 1, Kruidenier 1, Purple Rain 1, Grass Company 4, Happy Corner 1, Toermalijn 2)", delta: -10 },
    { label: "Niet afzonderlijk geraamd: Baba, Demo, The Plug East (#51, valt onder The Plug)", delta: -3 },
    { label: "Dubbele locatie binnen The Plug (Eerste/1e Oosterparkstraat 47)", delta: -1 },
    { label: "Hunters-correctie naar 13 (bevestigd door Simone)", delta: 4 },
    { label: "Tyson voorlopig 2 coffeeshops (registratie 1)", delta: 1 },
    { label: "GOA 1 locatie; Scolo (#32) apart lid", delta: -1 },
  ],
  tussenstappen: [{ naStap: 0, label: "bij 125 leden" }],
  kerngegevensNoot: "125 leden en 181 geregistreerde vermeldingen zijn brongegevens en blijven ongewijzigd. Kerngegevens toont ook 169, maar anders berekend: 171 min de overlap Scolo/GOA en The Plug East/The Plug, vóór de uitsluitingen en de Hunters-correctie.",
} as const;

export const CONTROLEPUNTEN: string[] = [
  "Baba en Demo: uitgesloten.",
  "The Plug: 6 unieke locaties aangenomen in plaats van 7 (Eerste/1e Oosterparkstraat 47), inclusief The Plug East (#51), dat volgens bevestiging van de gebruiker onder de groepscontributie van The Plug valt. Zonder de ontdubbeling +€ 2.000.",
  "Hunters: 13 locaties volgens bevestiging van Simone (25 november 2026), dus staffel meer dan 10 locaties (€ 10.000; +€ 2.000). De ledenregistratie noemt nog 9 locaties.",
  "Coffeeshop 010: 5 locaties, waarvan 3 zonder adres (bestaand, voorlopig; geen broncorrectie). Bij 2 locaties: −€ 1.500.",
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
    { name: "Voorzitter - Het Strategiebureau", budgeted: 102000, actual2026: null, basis: "Voorlopige raming, niet compleet; geen bevestigde loonberekening 2027. In 2027 vervangt loondienst de eerdere kosten als opdrachtnemer; eerdere facturen en salaris niet bij elkaar optellen. Salaris: bruto € 6.760 per maand × 12 = € 81.120 + 8% vakantiegeld € 6.489,60 = € 87.609,60 per jaar (arbeidsovereenkomst 2026, loonstrook oktober). Werkgeverspremies 2027 (broncontrole 25-11-2026) over het maximumpremieloon € 82.543: werkgevers-Zvw 6,27% = € 5.175,45 en maximumpremieloon definitief (Staatscourant 2026-39593, 13 november 2026); AWf laag 2,74% = € 2.261,68, Aof laag 6,67% = € 5.505,62 en WKO 0,50% = € 412,72 zijn voorgenomen tarieven (Kamerstuk 37020-XV-2, tabel 130) en nog definitief te controleren. Samen € 13.355,47 excl. Whk, onder aanname van dezelfde lage-premie-indeling als oktober 2026. Whk 2027 voor BCD is onbekend; uitsluitend als tijdelijke begrotingsaanname 12 × € 82 = € 984 volgens oktober 2026, geen bevestigd tarief. Totaal € 101.949,07, afgerond begroot € 102.000; niet afdoende voor overige personeelskosten. Vorige bron: loonaangifte oktober 2026 (e-mail Daan Kottmann, 'Loonheffingen BCD', 21 november 2026 10:10), afgeronde aangifte-euro's. Ingehouden loonheffing en nettoloon zijn onderdelen van het brutosalaris en worden niet nogmaals boven op het brutosalaris geteld. Open begrotingspunten, bedrag onbekend (niet nul, niet verzekerd): arbodienst/verzuimverzekering nog niet geregeld; vaste prijs salarisadministratie nog niet geregeld, af te stemmen met Administratiekosten (€ 5.500) om dubbel budget te voorkomen. Pensioen: volgens het contract buiten de verplichte pensioenregeling; geen aanvullende afspraak aangetroffen. Reiskosten en onkostenvergoedingen staan op eigen posten en zijn hier niet bijgeteld." },
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

export const WERKGEVER_WAARSCHUWING = "Loonbudget €102.000 (voorlopig, niet compleet): €101.949,07 op jaarbasis met maximumpremieloon en Zvw 2027 definitief, AWf/Aof/WKO voorgenomen en Whk als tijdelijke aanname. Arbodienst/verzuimverzekering en salarisadministratie nog niet geregeld, bedrag onbekend.";

export function conceptTotals(cats: readonly ConceptCategory[], incomeFull: number) {
  const perCategory = cats.map((c) => ({ name: c.name, total: c.lines.reduce((s, l) => s + l.budgeted, 0) }));
  const expenses = perCategory.reduce((s, c) => s + c.total, 0);
  return { perCategory, expenses, resultFull: incomeFull - expenses };
}

export type Begroting2027Snapshot = {
  uitgaven: ConceptCategory[];
  inkomsten: ConceptLine[];
  peildatum: string;
  staffel: { label: string; amount: number }[];
  rows: { label: string; count: number; amount: number }[];
  totalFull: number;
  totalGroups: number;
  groups: { id: number; name: string; shops: number; minimum?: boolean }[];
  leden: { id: number; name: string; shops: number }[];
  ledenRegistratie: { geregistreerd: number; uitgesloten: { id: number; name: string; reden: string }[] };
  aansluiting: { start: { label: string; aantal: number }; stappen: { label: string; delta: number }[]; tussenstappen: { naStap: number; label: string }[]; kerngegevensNoot: string };
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
    totalGroups: BEGROTING_2027.totalGroups,
    groups: MEERDERE_SHOPS_2027.map((g) => ({ ...g })),
    leden: RAMINGSLEDEN_2027.map((g) => ({ ...g })),
    ledenRegistratie: { geregistreerd: LEDENREGISTRATIE_2027.geregistreerd, uitgesloten: LEDENREGISTRATIE_2027.uitgesloten.map((u) => ({ ...u })) },
    aansluiting: JSON.parse(JSON.stringify(VESTIGINGEN_AANSLUITING_2027)),
    controlepunten: [...CONTROLEPUNTEN],
    werkgeverWaarschuwing: WERKGEVER_WAARSCHUWING,
    uitgaven: UITGAVEN_2027.map((c) => ({ name: c.name, lines: c.lines.map((l) => ({ ...l })) })),
    inkomsten: [
      { name: "Contributies", budgeted: BEGROTING_2027.totalFull, actual2026: null, basis: "Volledige staffel (niet vastgesteld)." },
      { name: "Donaties en overige baten", budgeted: 0, actual2026: null, basis: "Niet bevestigd; daarom niet geraamd." },
    ],
  };
}
