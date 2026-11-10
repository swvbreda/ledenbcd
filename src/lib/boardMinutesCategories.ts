export const MINUTES_CATEGORIES = [
  ['bestuursvergaderingen', 'Bestuursvergaderingen'],
  ['algemene-ledenvergaderingen', 'Algemene ledenvergaderingen'],
  ['gemeenten', 'Gemeenten'],
  ['banken', 'Banken en betalingsverkeer'],
  ['landelijk-overleg', 'Landelijk overleg'],
  ['samenwerking-pcn', 'Samenwerking PCN'],
  ['experiment', 'Experiment gesloten coffeeshopketen'],
  ['werkgroep-x', 'Werkgroep X'],
  ['regulering', 'Regulering en legalisering'],
  ['keurmerk', 'Keurmerk'],
  ['tweede-kamer', 'Tweede Kamer en politiek'],
  ['trimbos', 'Trimbos'],
  ['bestuurlijke-voorbereiding', 'Bestuurlijke voorbereiding'],
  ['juridisch-overleg', 'Juridisch overleg'],
  ['straatdealerscampagne', 'Straatdealerscampagne'],
  ['stuurgroep', 'Stuurgroep'],
  ['overleg-contacten', 'Overleg met contacten'],
  ['overige', 'Overige bijeenkomsten'],
] as const;
export type MinutesCategory = typeof MINUTES_CATEGORIES[number][0];
export const MINUTES_CATEGORY_IDS = MINUTES_CATEGORIES.map(c => c[0]) as [MinutesCategory, ...MinutesCategory[]];
export const BOARD_CATEGORY: MinutesCategory = 'bestuursvergaderingen';
export const categoryLabel = (id: string) => MINUTES_CATEGORIES.find(c => c[0] === id)?.[1] ?? 'Overige bijeenkomsten';

type Meeting = { id: string; category?: string | null; subcategory?: string | null };
/** Counts every category (including empty ones) and gemeente subcategories from stored meetings only. */
export function categoryCounts(meetings: Meeting[]) {
  const counts = new Map<string, number>(MINUTES_CATEGORIES.map(c => [c[0], 0]));
  const gemeenten = new Map<string, number>();
  for (const m of meetings) {
    const c = m.category ?? BOARD_CATEGORY;
    counts.set(c, (counts.get(c) ?? 0) + 1);
    if (c === 'gemeenten') { const g = m.subcategory?.trim() || 'Gemeente onbekend'; gemeenten.set(g, (gemeenten.get(g) ?? 0) + 1); }
  }
  return { counts, gemeenten: [...gemeenten].sort((a, b) => a[0].localeCompare(b[0], 'nl')) };
}
