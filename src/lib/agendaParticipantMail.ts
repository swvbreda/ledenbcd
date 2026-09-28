/**
 * "Mail alle deelnemers" voor één agenda-item.
 *
 * Pure logica (geen netwerk), zodat ontvangerskeuze, autorisatie en
 * idempotentie met mocks getest kunnen worden. De serverfunctie levert de
 * afhankelijkheden aan; de browser kiest nooit zelf ontvangers.
 */

const EMAIL_RE = /^[^\s@"'<>,;:()[\]\\]+@[^\s@"'<>,;:()[\]\\]+\.[^\s@"'<>,;:()[\]\\]{2,}$/;

export function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export function isValidEmail(v: string): boolean {
  return v.length <= 254 && EMAIL_RE.test(v);
}

/** Gaststatussen die NIET gemaild worden (geweigerd/afgemeld). */
const EXCLUDED_GUEST_STATUS = new Set([
  "geweigerd",
  "afgewezen",
  "afgemeld",
  "geannuleerd",
  "declined",
  "rejected",
  "cancelled",
  "canceled",
]);

export interface RegistrationRow {
  id: string;
  member_id: number | null;
  board_member_id: string | null;
  contact_email: string | null;
  contact_name: string | null;
  attendee_names?: string[] | null;
}

export interface GuestRow {
  id: string;
  naam: string | null;
  email: string | null;
  status: string | null;
}

export interface ParticipantRecipient {
  email: string;
  naam: string;
  sources: ("lid" | "bestuur" | "gast" | "aanmelding")[];
}

export interface MissingParticipant {
  naam: string;
  source: "lid" | "bestuur" | "gast" | "aanmelding";
  reason: "missing" | "invalid" | "ambiguous";
  value?: string;
}

export interface RecipientResult {
  recipients: ParticipantRecipient[];
  missing: MissingParticipant[];
  excluded: number;
}

export function buildParticipantRecipients(input: {
  registrations: RegistrationRow[];
  guests: GuestRow[];
  /** Alle toegestane adressen per lid; alleen een eenduidig geldig adres telt als terugval. */
  emailsByMember: Map<number, string[]>;
  nameByMember?: Map<number, string>;
  /** Gecontroleerde terugval: bond_email || email van het bestuurslid. */
  emailByBoard: Map<string, string>;
  nameByBoard?: Map<string, string>;
}): RecipientResult {
  const byEmail = new Map<string, ParticipantRecipient>();
  const missing: MissingParticipant[] = [];
  let excluded = 0;

  const add = (
    raw: string,
    naam: string,
    source: ParticipantRecipient["sources"][number],
  ) => {
    const email = normalizeEmail(raw);
    if (!email) return void missing.push({ naam, source, reason: "missing" });
    if (!isValidEmail(email))
      return void missing.push({ naam, source, reason: "invalid", value: email });
    const existing = byEmail.get(email);
    if (existing) {
      if (!existing.sources.includes(source)) existing.sources.push(source);
      return;
    }
    byEmail.set(email, { email, naam, sources: [source] });
  };

  for (const r of input.registrations) {
    const source: ParticipantRecipient["sources"][number] = r.board_member_id
      ? "bestuur"
      : r.member_id != null
        ? "lid"
        : "aanmelding";
    const naam =
      (r.contact_name ?? "").trim() ||
      (r.board_member_id ? input.nameByBoard?.get(r.board_member_id) : undefined) ||
      (r.member_id != null ? input.nameByMember?.get(r.member_id) : undefined) ||
      (r.attendee_names ?? []).find((n) => n && n.trim())?.trim() ||
      "deelnemer";
    // Registratie-adres eerst; alleen als dat leeg is de gecontroleerde terugval.
    if (normalizeEmail(r.contact_email)) {
      add(String(r.contact_email), naam, source);
      continue;
    }
    if (r.board_member_id) {
      add(input.emailByBoard.get(r.board_member_id) ?? "", naam, source);
      continue;
    }
    if (r.member_id != null) {
      const valid = [
        ...new Set((input.emailsByMember.get(r.member_id) ?? []).map(normalizeEmail).filter(isValidEmail)),
      ];
      if (valid.length > 1) {
        missing.push({ naam, source, reason: "ambiguous", value: `${valid.length} adressen` });
        continue;
      }
      add(valid[0] ?? "", naam, source);
      continue;
    }
    add("", naam, source);
  }

  for (const g of input.guests) {
    const status = normalizeEmail(g.status);
    if (EXCLUDED_GUEST_STATUS.has(status)) {
      excluded++;
      continue;
    }
    add(g.email ?? "", (g.naam ?? "").trim() || "gast", "gast");
  }

  const recipients = [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
  return { recipients, missing, excluded };
}

export function validateMessage(subject: unknown, body: unknown) {
  const s = String(subject ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  const b = String(body ?? "").replace(/\r\n?/g, "\n").trim();
  if (!s) throw new Error("Vul een onderwerp in");
  if (s.length > 200) throw new Error("Onderwerp is te lang (max. 200 tekens)");
  if (!b) throw new Error("Vul een bericht in");
  if (b.length > 10000) throw new Error("Bericht is te lang (max. 10.000 tekens)");
  return { subject: s, body: b };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function assertUuid(v: unknown, label: string): string {
  const s = String(v ?? "");
  if (!UUID_RE.test(s)) throw new Error(`Ongeldige ${label}`);
  return s.toLowerCase();
}

