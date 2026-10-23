/**
 * Projectmail (RCF): gecodeerde mails uit één vaste postbus koppelen aan bestaande projecten.
 * Pure kern zonder I/O; Microsoft wordt uitsluitend gelezen. Mailinhoud is onbetrouwbare data.
 */

export const PROJECTMAIL_MAILBOX = "info@coffeeshopbond.nl";
export const MAX_PAGES = 10;
export const MAX_ATTEMPTS = 5;
export const MAX_AUTO_TASKS = 5;
export const INITIAL_LOOKBACK_DAYS = 30;

const CODE_RE = /^BCD-[A-Z0-9]{3,20}$/;

export type SubjectMatch =
  | { kind: "none" }
  | { kind: "one"; code: string }
  | { kind: "multiple"; codes: string[] }
  | { kind: "invalid"; tokens: string[] };

/** Exacte bracket-tokens (case-insensitief). Alleen tokens die met BCD beginnen tellen; geen fuzzy/titelmatch. */
export function parseSubjectCodes(subject: string | null | undefined): SubjectMatch {
  const tokens = [...String(subject ?? "").matchAll(/\[([^[\]]{1,60})\]/g)].map((m) => m[1].trim());
  const bcd = tokens.filter((t) => /^bcd\b/i.test(t) || /^bcd-/i.test(t));
  if (!bcd.length) return { kind: "none" };
  const valid = new Set<string>(), invalid: string[] = [];
  for (const t of bcd) {
    const up = t.toUpperCase();
    if (CODE_RE.test(up)) valid.add(up); else invalid.push(t);
  }
  if (invalid.length) return { kind: "invalid", tokens: invalid };
  if (valid.size > 1) return { kind: "multiple", codes: [...valid].sort() };
  return { kind: "one", code: [...valid][0] };
}

/** HTML → platte tekst; scripts/styles weg, tags weg, entiteiten minimaal. Nooit renderen als HTML. */
export function toPlainText(content: string, type: string | undefined): string {
  let s = String(content ?? "");
  if ((type ?? "").toLowerCase() === "html") {
    s = s.replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }
  return s.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, 12_000);
}

export const normTitle = (t: string) => t.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const normQuote = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();

export interface RawExtraction {
  stand_van_zaken?: unknown;
  vervolg?: unknown;
  taken?: unknown;
  taakstatus?: unknown;
}
export interface TaskCandidate { title: string; quote: string; norm: string }
export interface Extraction {
  summary: string | null;
  nextSteps: string | null;
  autoTasks: TaskCandidate[];
  reviewTasks: (TaskCandidate & { why: string })[];
  statusNotes: { text: string; quote: string }[];
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max) : "");

/**
 * Validatie van AI-uitvoer: alleen kandidaten met een letterlijke bronzin uit de mail;
 * eigenaar/deadline nooit overnemen (→ beoordeling); bestaande-taakstatus altijd naar beoordeling.
 */
export function validateExtraction(raw: RawExtraction | null | undefined, body: string, openTaskNorms: Set<string>): Extraction {
  const src = normQuote(body);
  const out: Extraction = { summary: str(raw?.stand_van_zaken, 2000) || null, nextSteps: str(raw?.vervolg, 2000) || null, autoTasks: [], reviewTasks: [], statusNotes: [] };
  const seen = new Set<string>();
  for (const t of Array.isArray(raw?.taken) ? raw!.taken as Record<string, unknown>[] : []) {
    const title = str(t?.titel, 140), quote = str(t?.bronzin, 400), norm = normTitle(title);
    if (title.length < 3 || !norm || seen.has(norm)) continue;
    seen.add(norm);
    const c = { title, quote, norm };
    if (!quote || !src.includes(normQuote(quote))) { out.reviewTasks.push({ ...c, why: "bron_niet_gevonden" }); continue; }
    if (openTaskNorms.has(norm)) continue; // bestaat al als open taak
    if (t?.expliciet !== true) { out.reviewTasks.push({ ...c, why: "niet_expliciet" }); continue; }
    if (t?.eigenaar_genoemd === true) { out.reviewTasks.push({ ...c, why: "eigenaar_genoemd" }); continue; }
    if (t?.deadline_genoemd === true) { out.reviewTasks.push({ ...c, why: "deadline_genoemd" }); continue; }
    if (out.autoTasks.length >= MAX_AUTO_TASKS) { out.reviewTasks.push({ ...c, why: "te_veel" }); continue; }
    out.autoTasks.push(c);
  }
  for (const s of Array.isArray(raw?.taakstatus) ? raw!.taakstatus as Record<string, unknown>[] : []) {
    const text = str(s?.beschrijving, 300), quote = str(s?.bronzin, 400);
    if (text && quote && src.includes(normQuote(quote))) out.statusNotes.push({ text, quote });
  }
  return out;
}

export interface MailMeta { id: string; subject: string; receivedDateTime: string; internetMessageId?: string | null; webLink?: string | null; removed?: boolean }
export interface DeltaPage { items: MailMeta[]; next: string | null; delta: string | null }
export interface MailGraph {
  delta(checkpoint: string | null, sinceIso: string): Promise<DeltaPage>;
  body(id: string): Promise<string>;
}
export interface CodeRow { project_id: string; reference_code: string; active: boolean; archived: boolean }
export interface MailDb {
  codes(): Promise<CodeRow[]>;
  checkpoint(): Promise<string | null>;
  saveCheckpoint(token: string): Promise<void>;
  /** Bestaande rij of nieuwe rij (idempotent op mailbox+bron-id+project); attempts++ */
  beginMessage(m: MailMeta, c: CodeRow): Promise<{ id: string; status: string; attempts: number }>;
  finishMessage(id: string, ok: { summary: string | null; nextSteps: string | null } | { error: string; final: boolean }): Promise<void>;
  review(key: string, reason: string, m: MailMeta, projectId: string | null, detail: Record<string, unknown>): Promise<void>;
  openTaskNorms(projectId: string): Promise<Set<string>>;
  /** Idempotent via import_ref; geeft task-id terug. */
  createTask(projectId: string, title: string, importRef: string): Promise<string | null>;
  candidate(messageId: string, c: TaskCandidate, decision: "aangemaakt" | "review", taskId: string | null): Promise<void>;
}
export type Extractor = (input: { subject: string; body: string }) => Promise<RawExtraction>;

export interface RunCounts { scanned: number; coded: number; processed: number; reviews: number; tasks: number; skipped: number; failed: number; pages: number; complete: boolean }

export const safeWebLink = (u: string | null | undefined) =>
  typeof u === "string" && /^https:\/\/outlook\.(office|office365|live)\.com\//.test(u) ? u.slice(0, 2000) : null;

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/** Eén begrensde run. Checkpoint pas na volledige verwerking van een pagina. Gooit bij tijdelijke fout (checkpoint blijft staan). */
export async function runProjectMail(g: MailGraph, db: MailDb, extract: Extractor, now = new Date()): Promise<RunCounts> {
  const r: RunCounts = { scanned: 0, coded: 0, processed: 0, reviews: 0, tasks: 0, skipped: 0, failed: 0, pages: 0, complete: false };
  const codes = await db.codes();
  const byCode = new Map(codes.map((c) => [c.reference_code.toUpperCase(), c]));
  const since = new Date(now.getTime() - INITIAL_LOOKBACK_DAYS * 86_400_000).toISOString();
  let cp = await db.checkpoint();
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await g.delta(cp, since);
    r.pages++;
    for (const m of page.items) {
      if (m.removed || !m.id) continue;
      r.scanned++;
      const match = parseSubjectCodes(m.subject);
      if (match.kind === "none") continue; // ongecodeerd: niets opslaan
      r.coded++;
      const rk = (reason: string) => `${PROJECTMAIL_MAILBOX}|${m.id}|${reason}`;
      if (match.kind === "multiple") { await db.review(rk("meerdere_codes"), "meerdere_codes", m, null, { codes: match.codes }); r.reviews++; continue; }
      if (match.kind === "invalid") { await db.review(rk("ongeldige_code"), "ongeldige_code", m, null, {}); r.reviews++; continue; }
      const c = byCode.get(match.code);
      if (!c) { await db.review(rk("onbekende_code"), "onbekende_code", m, null, { code: match.code }); r.reviews++; continue; }
      if (c.archived) { await db.review(rk("project_gearchiveerd"), "project_gearchiveerd", m, c.project_id, {}); r.reviews++; continue; }
      if (!c.active) { await db.review(rk("project_gepauzeerd"), "project_gepauzeerd", m, c.project_id, {}); r.reviews++; continue; }
      const row = await db.beginMessage(m, c);
      if (row.status === "verwerkt" || row.status === "fout") { r.skipped++; continue; }
      try {
        const body = await g.body(m.id);
        const ex = validateExtraction(await extract({ subject: m.subject, body }), body, await db.openTaskNorms(c.project_id));
        for (const t of ex.autoTasks) {
          const id = await db.createTask(c.project_id, t.title, `projectmail:${await sha(`${PROJECTMAIL_MAILBOX}|${m.id}|${c.project_id}|${t.norm}`)}`);
          await db.candidate(row.id, t, "aangemaakt", id);
          r.tasks++;
        }
        for (const t of ex.reviewTasks) {
          await db.candidate(row.id, t, "review", null);
          await db.review(rk(`taak:${t.norm}`), "taak_onzeker", m, c.project_id, { titel: t.title, bronzin: t.quote, reden: t.why });
          r.reviews++;
        }
        for (const s of ex.statusNotes) {
          await db.review(rk(`status:${normTitle(s.text)}`), "taakstatus", m, c.project_id, { beschrijving: s.text, bronzin: s.quote });
          r.reviews++;
        }
        await db.finishMessage(row.id, { summary: ex.summary, nextSteps: ex.nextSteps });
        r.processed++;
      } catch (e) {
        const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300);
        const final = row.attempts >= MAX_ATTEMPTS;
        await db.finishMessage(row.id, { error: msg, final });
        r.failed++;
        if (!final) throw new Error(`Verwerking onderbroken: ${msg}`);
        await db.review(rk("verwerkingsfout"), "verwerkingsfout", m, c.project_id, { fout: msg });
      }
    }
    const token = page.next ?? page.delta;
    if (token) { await db.saveCheckpoint(token); cp = token; }
    if (!page.next) { r.complete = true; break; }
  }
  return r;
}
