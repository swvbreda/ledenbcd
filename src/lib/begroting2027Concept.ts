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
