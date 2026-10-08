// Eenduidige weergave van declaratiesoorten. Onbekende soorten worden niet als "overig" benoemd.
const LABELS: Record<string, string> = {
  reiskosten: "Kilometervergoeding",
  overig: "Overige reiskosten",
  penningmeester: "Vrijwilligersvergoeding — penningmeester",
  woordvoering: "Vrijwilligersvergoeding — woordvoering",
};

export function declarationTypeLabel(type: string | null | undefined): string {
  if (!type) return "Onbekende soort";
  return LABELS[type] ?? `Onbekende soort (${type})`;
}

export const isVolunteerAllowance = (type: string | null | undefined) => type === "penningmeester" || type === "woordvoering";

/** Omschrijving; lege maandvergoeding krijgt "Vrijwilligersvergoeding mei 2026" uit de bestaande kostendatum. */
export function declarationDescription(d: { appointment: string | null; declaration_type: string; expense_date: string | null }, fallback = "Geen omschrijving"): string {
  if (d.appointment && d.appointment.trim()) return d.appointment;
  if (isVolunteerAllowance(d.declaration_type) && d.expense_date) {
    const [y, m] = d.expense_date.split("-").map(Number);
    if (y && m) return `Vrijwilligersvergoeding ${new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("nl-NL", { month: "long", year: "numeric", timeZone: "UTC" })}`;
  }
  return fallback;
}
