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

/**
 * Uitkomst van één verzendpoging, eerlijk vertaald uit de verzendfunctie:
 *  - sent:      provider bevestigde aflevering-aanname (sent:true)
 *  - accepted:  alleen 'success'/'queued' zonder bevestiging → NIET als verzonden tellen
 *  - skipped:   afgeschreven adres
 *  - failed:    provider/validatie weigerde zeker → mag opnieuw
 *  - uncertain: netwerk/5xx; mail kan zijn aangekomen → nooit automatisch opnieuw
 */
export type SendOutcome = {
  status: "sent" | "accepted" | "skipped" | "failed" | "uncertain";
  note?: string;
};

export function interpretSendResponse(
  data: unknown,
  error: { status?: number; message?: string } | null,
): SendOutcome {
  if (error) {
    const s = error.status;
    if (s != null && s >= 400 && s < 500) return { status: "failed", note: `HTTP ${s}` };
    if (s === 502) return { status: "failed", note: "Mailprovider weigerde" };
    return { status: "uncertain", note: error.message ?? `HTTP ${s ?? "?"}` };
  }
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.suppressed === true || d.reason === "email_suppressed" || d.skipped === true)
    return { status: "skipped", note: "Afgeschreven adres" };
  if (d.success === false && d.reason === "already_sent")
    return { status: "sent", note: "Eerder al verzonden" };
  if (d.success === false) return { status: "failed", note: String(d.reason ?? "geweigerd") };
  if (d.sent === true) return { status: "sent" };
  if (d.success === true || d.queued === true)
    return { status: "accepted", note: "Aangenomen, verzending niet bevestigd" };
  return { status: "uncertain", note: "Onbekend antwoord" };
}

export interface BatchRow {
  id: string;
  event_id: string;
  subject: string;
  body: string;
}
export interface SendRow {
  email: string;
  naam: string | null;
  status: "pending" | "claimed" | "sent" | "accepted" | "skipped" | "failed" | "uncertain";
  note: string | null;
}

export interface MailDeps {
  isAdmin(): Promise<boolean>;
  loadEvent(eventId: string): Promise<{ id: string; title: string } | null>;
  /** Actuele deelnemers volgens de server; gooit bij leesfouten. */
  loadRecipients(eventId: string): Promise<RecipientResult>;
  /** Atomair: batch + ontvangerssnapshot; niets bij bestaande id. */
  createBatch(b: BatchRow, snapshot: ParticipantRecipient[]): Promise<void>;
  getBatch(batchId: string): Promise<BatchRow | null>;
  /** Claimt uitsluitend snapshot-rijen (pending/failed) die nog actief zijn. */
  claim(batchId: string, stillActive: string[]): Promise<string[]>;
  mark(batchId: string, email: string, outcome: SendOutcome): Promise<void>;
  listStatuses(batchId: string): Promise<SendRow[]>;
  send(input: {
    email: string;
    naam: string;
    subject: string;
    body: string;
    eventTitle: string;
    idempotencyKey: string;
  }): Promise<SendOutcome>;
}

export interface MailReport {
  batchId: string;
  subject: string;
  body: string;
  sent: number;
  accepted: number;
  skipped: number;
  failed: number;
  uncertain: number;
  inProgress: number;
  /** Snapshot-ontvangers die intussen geen deelnemer meer zijn. */
  noLongerParticipant: string[];
  failedEmails: string[];
  rows: SendRow[];
}

export class RecipientsChangedError extends Error {
  constructor(public added: string[], public removed: string[]) {
    super("De deelnemerslijst is gewijzigd sinds de voorbeeldweergave. Controleer opnieuw.");
  }
}

function sameSet(a: string[], b: string[]) {
  const A = new Set(a), B = new Set(b);
  return {
    added: [...B].filter((x) => !A.has(x)),
    removed: [...A].filter((x) => !B.has(x)),
  };
}

export async function runParticipantMail(
  deps: MailDeps,
  input: {
    batchId: string;
    eventId: string;
    subject: string;
    body: string;
    /** Adressen uit de preview die de beheerder bevestigde (alleen bij nieuwe batch). */
    expectedEmails?: string[];
  },
): Promise<MailReport> {
  assertUuid(input.batchId, "batchId");
  assertUuid(input.eventId, "eventId");
  if (!(await deps.isAdmin())) throw new Error("Geen toegang");
  const event = await deps.loadEvent(input.eventId);
  if (!event) throw new Error("Evenement niet gevonden");

  const current = await deps.loadRecipients(input.eventId);
  const currentEmails = current.recipients.map((r) => r.email);

  let batch = await deps.getBatch(input.batchId);
  if (!batch) {
    const msg = validateMessage(input.subject, input.body);
    if (!input.expectedEmails) throw new Error("Ontvangersbevestiging ontbreekt");
    const diff = sameSet(input.expectedEmails.map(normalizeEmail), currentEmails);
    if (diff.added.length || diff.removed.length)
      throw new RecipientsChangedError(diff.added, diff.removed);
    await deps.createBatch(
      { id: input.batchId, event_id: input.eventId, subject: msg.subject, body: msg.body },
      current.recipients,
    );
    // Canonieke batch herlezen: bij een race wint de opgeslagen tekst.
    batch = await deps.getBatch(input.batchId);
    if (!batch) throw new Error("Verzending kon niet worden vastgelegd");
  }
  if (batch.event_id !== input.eventId) throw new Error("Verzending hoort bij een ander evenement");

  const claimed = await deps.claim(batch.id, currentEmails);
  const byEmail = new Map(current.recipients.map((r) => [r.email, r]));
  for (const email of claimed) {
    const r = byEmail.get(email);
    let outcome: SendOutcome;
    try {
      outcome = await deps.send({
        email,
        naam: r?.naam ?? "deelnemer",
        subject: batch.subject,
        body: batch.body,
        eventTitle: event.title,
        idempotencyKey: `agenda-mail-${batch.id}-${email}`,
      });
    } catch (e) {
      outcome = { status: "uncertain", note: e instanceof Error ? e.message : "Onbekende fout" };
    }
    await deps.mark(batch.id, email, outcome); // fouten hier niet inslikken
  }

  const rows = await deps.listStatuses(batch.id);
  const active = new Set(currentEmails);
  const count = (s: SendRow["status"]) => rows.filter((x) => x.status === s).length;
  return {
    batchId: batch.id,
    subject: batch.subject,
    body: batch.body,
    sent: count("sent"),
    accepted: count("accepted"),
    skipped: count("skipped"),
    failed: count("failed"),
    uncertain: count("uncertain"),
    inProgress: count("claimed"),
    noLongerParticipant: rows
      .filter((x) => (x.status === "pending" || x.status === "failed") && !active.has(x.email))
      .map((x) => x.email),
    failedEmails: rows.filter((x) => x.status === "failed").map((x) => x.email),
    rows,
  };
}
