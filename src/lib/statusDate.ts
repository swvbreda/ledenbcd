/** Statusdatum (DATE 'YYYY-MM-DD') als Nederlandse tekst, zonder UTC-dagverschuiving. */
export function fmtStatusDate(d: string | null | undefined): string | null {
  const m = d?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const dt = new Date(+m[1], +m[2] - 1, +m[3]);
  if (dt.getFullYear() !== +m[1] || dt.getMonth() !== +m[2] - 1 || dt.getDate() !== +m[3]) return null;
  return dt.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}
export const statusDateLabel = (d: string | null | undefined) => {
  const f = fmtStatusDate(d);
  return f ? `Stand per ${f}` : "Statusdatum niet vastgelegd";
};
