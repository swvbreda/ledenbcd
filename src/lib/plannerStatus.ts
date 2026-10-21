export type PlannerStatusData = { configured: boolean; readOnly?: boolean; roles: string[]; canRead: boolean; canWrite: boolean; canListGroups: boolean; error: string | null };

/** Eerlijke status: "verbonden" pas als Microsoft daadwerkelijk schrijfrechten op Planner geeft. */
export function plannerReadiness(s: PlannerStatusData | null) {
  if (!s) return { level: "unknown" as const, label: "Onbekend", detail: "Status nog niet opgehaald.", canRead: false, canWrite: false };
  if (!s.configured) return { level: "off" as const, label: "Niet ingesteld", detail: "Microsoft-servergegevens ontbreken.", canRead: false, canWrite: false };
  if (s.error) return { level: "error" as const, label: "Fout", detail: "Aanmelden bij Microsoft lukte niet.", canRead: false, canWrite: false };
  if (!s.canRead) return {
    level: "blocked" as const, label: "Code klaar, geen Planner-toegang",
    detail: "De Microsoft-app heeft nog geen applicatierecht Tasks.ReadWrite.All (met beheerderstoestemming). Tot die tijd wordt er niets gelezen of geschreven.",
    canRead: false, canWrite: false,
  };
  if (s.readOnly) return { level: "read" as const, label: "Leesmodus", detail: "Microsoft is leidend: taken worden alleen uit Planner geïmporteerd, nooit naar Planner geschreven.", canRead: true, canWrite: false };
  if (!s.canWrite) return { level: "read" as const, label: "Alleen lezen", detail: "Tasks.Read.All aanwezig; voor synchroniseren is Tasks.ReadWrite.All nodig.", canRead: true, canWrite: false };
  return { level: "ok" as const, label: "Planner-toegang actief", detail: s.canListGroups ? "Teams kunnen worden gekozen uit de lijst." : "Vul de groeps-ID van het team in (Group.Read.All ontbreekt voor een teamlijst).", canRead: true, canWrite: true };
}
