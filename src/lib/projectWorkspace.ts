export type StaffMember = { user_id: string; email: string; full_name?: string | null };
export type ActorKind = "medewerker" | "bronimport" | "systeem";
export type CheckpointStatus = "open" | "bezig" | "gereed" | "nvt";
export const CHECKPOINT_STATUS_LABEL: Record<CheckpointStatus, string> = { open: "Open", bezig: "Bezig", gereed: "Gereed", nvt: "N.v.t." };
export type MessageKind = "bericht" | "notitie" | "voortgang" | "bronupdate";
export const NOT_RECORDED = "Niet geregistreerd";

/** Initialen uit de echte accountnaam; anders uit het e-mailadres (voor de @). */
export function initialsFor(s: Pick<StaffMember, "email" | "full_name"> | undefined | null): string {
  if (!s) return "?";
  const name = s.full_name?.trim();
  const parts = (name || s.email.split("@")[0]).split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] ?? "";
  return (first + last).toUpperCase();
}
export const displayName = (s: StaffMember | undefined | null) => (s ? s.full_name?.trim() || s.email : "Onbekend account");

/** Wie heeft het gedaan: medewerker, bronimport of eerlijk 'Niet geregistreerd'. */
export function actorLabel(kind: ActorKind | null | undefined, actorId: string | null | undefined, staff: StaffMember[]): string {
  if (kind === "bronimport") return "Bronimport";
  if (!actorId) return kind === "systeem" ? "Systeem" : NOT_RECORDED;
  return displayName(staff.find((x) => x.user_id === actorId));
}

type TaskLite = { project_id: string | null; status: string; assignee_id: string | null };
export function projectProgress(tasks: TaskLite[], projectId: string) {
  const own = tasks.filter((t) => t.project_id === projectId);
  const done = own.filter((t) => t.status === "afgerond").length;
  const open = own.length - done;
  return { open, done, total: own.length, pct: own.length ? Math.round((done / own.length) * 100) : null };
}

/** Deelnemers = verantwoordelijke + expliciete deelnemers + uitvoerders van projecttaken. Niemand anders. */
export function participantIds(project: { id: string; owner_id: string | null }, tasks: TaskLite[], explicit: { project_id: string; user_id: string }[]): string[] {
  const ids: string[] = [];
  const add = (id: string | null) => { if (id && !ids.includes(id)) ids.push(id); };
  add(project.owner_id);
  explicit.filter((e) => e.project_id === project.id).forEach((e) => add(e.user_id));
  tasks.filter((t) => t.project_id === project.id).forEach((t) => add(t.assignee_id));
  return ids;
}

/** Mag de huidige gebruiker deze taak oppakken? Alleen niet-toegewezen, open taken. */
export const canClaim = (t: { assignee_id: string | null; status: string }) => !t.assignee_id && t.status !== "afgerond";

/** Bedrag: leeg = onbekend (null); nooit 0 invullen voor onbekend. */
export function parseAmount(raw: string): number | null | "invalid" {
  const s = raw.trim().replace(/\s|€/g, "");
  if (!s) return null;
  const norm = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^\d+(\.\d{1,2})?$/.test(norm)) return "invalid";
  return Number(norm);
}

export type SourceUpdateInput = { source_date: string; source_subject: string; source_mailbox: string; source_ref: string; last_action: string; next_step: string };
/** Een bronupdate is pas geldig met datum, onderwerp, mailbox, bron-ID, laatste actie én volgende stap. */
export function missingSourceFields(u: Partial<SourceUpdateInput>): (keyof SourceUpdateInput)[] {
  const keys: (keyof SourceUpdateInput)[] = ["source_date", "source_subject", "source_mailbox", "source_ref", "last_action", "next_step"];
  return keys.filter((k) => !u[k]?.trim());
}
