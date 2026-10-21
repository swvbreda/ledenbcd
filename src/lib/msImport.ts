/**
 * Eenrichtingsimport Microsoft -> ledenbestand (BCD-agenda + Planner "To do").
 * Pure logica + engine met geïnjecteerde poorten. De Graph-poort kan uitsluitend lezen;
 * er bestaat in deze module geen pad naar createTask/patchTask/patchDetails/completeTodo.
 */
import { skipForGenericPlanner } from "@/lib/topicalLink";

export const IMPORT_MAILBOX = "simone@coffeeshopbond.nl";
/** Bevestigd via onafhankelijke Outlook-profielread (2026-10-21). */
export const IMPORT_MAILBOX_ENTRA_ID = "07a25b88-ef99-4c2a-bba7-44aac8679db1";
/** Aparte, niet-standaard agenda "BCD" (standaard REST-id, geen ImmutableId — de import vraagt ook geen ImmutableId aan). */
export const IMPORT_CALENDAR_ID = "AAMkADk4Y2RiODc2LWE0MmItNGYwNS1iY2ExLTRhMzk2NzI4YmJhZQBGAAAAAAD9HfbZJGsFTZ4QRq02J-rOBwBBtJIYhrAZQJ4MRFt3l07ZAAAAAAEGAABBtJIYhrAZQJ4MRFt3l07ZAAFd2lnmAAA=";
export const IMPORT_PLAN_ID = "ihOF3XJjZU-XVqZD1yqJ4JgAEVQ6";
export const AGENDA_WINDOW_PAST_DAYS = 1;
export const AGENDA_WINDOW_FUTURE_DAYS = 180;

// ---------- Agenda ----------

export interface RawEvent {
  id: string; subject?: string | null; isAllDay?: boolean; isCancelled?: boolean; type?: string;
  start?: { dateTime?: string; timeZone?: string } | null; end?: { dateTime?: string; timeZone?: string } | null;
  location?: { displayName?: string | null } | null; onlineMeeting?: { joinUrl?: string | null } | null;
  iCalUId?: string | null; seriesMasterId?: string | null; originalStart?: string | null; lastModifiedDateTime?: string | null;
}
export interface AgendaItem {
  event_id: string; title: string; date: string; start_time: string | null; end_time: string | null; location: string | null;
  teams_url: string | null; ical_uid: string | null; series_master_id: string | null; kind: string | null;
  original_start: string | null; last_modified: string | null; cancelled: boolean;
}

const AMS = /^(Europe\/Amsterdam|W\. Europe Standard Time)$/;
const UTC = /^(UTC|Etc\/UTC|Coordinated Universal Time)$/;

/** Lokale Amsterdamse datum + tijd. Onbekende tijdzone = null (item wordt niet gegokt). */
export function toAmsterdam(dt: { dateTime?: string; timeZone?: string } | null | undefined): { date: string; time: string } | null {
  if (!dt?.dateTime || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dt.dateTime)) return null;
  const tz = dt.timeZone ?? "";
  if (AMS.test(tz)) return { date: dt.dateTime.slice(0, 10), time: dt.dateTime.slice(11, 16) };
  if (!UTC.test(tz)) return null;
  const d = new Date(dt.dateTime.slice(0, 19) + "Z");
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

const TEAMS = /^https:\/\/(teams\.microsoft\.com|teams\.live\.com)\//i;

/** Zet een Graph-afspraak om naar het minimale importrecord; null = niet veilig omzetbaar. */
export function toAgendaItem(e: RawEvent): AgendaItem | null {
  if (!e?.id || e.type === "seriesMaster") return null;
  let date: string, start: string | null = null, end: string | null = null;
  if (e.isAllDay) {
    const d = e.start?.dateTime?.slice(0, 10);
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
    date = d;
  } else {
    const s = toAmsterdam(e.start), en = toAmsterdam(e.end);
    if (!s) return null;
    date = s.date; start = s.time; end = en && en.date === s.date ? en.time : null;
  }
  const join = e.onlineMeeting?.joinUrl ?? null;
  const loc = (e.location?.displayName ?? "").trim();
  return {
    event_id: e.id, title: (e.subject ?? "").trim().slice(0, 200) || "(zonder titel)", date, start_time: start, end_time: end,
    location: loc ? loc.slice(0, 300) : null, teams_url: join && TEAMS.test(join) ? join : null,
    ical_uid: e.iCalUId ?? null, series_master_id: e.seriesMasterId ?? null, kind: e.type ?? null,
    original_start: e.originalStart ?? null, last_modified: e.lastModifiedDateTime ?? null, cancelled: !!e.isCancelled,
  };
}

export function agendaWindow(now: Date) {
  const from = new Date(now.getTime() - AGENDA_WINDOW_PAST_DAYS * 86_400_000);
  const to = new Date(now.getTime() + AGENDA_WINDOW_FUTURE_DAYS * 86_400_000);
  return { fromIso: from.toISOString(), toIso: to.toISOString(), fromDate: from.toISOString().slice(0, 10), toDate: to.toISOString().slice(0, 10) };
}

// ---------- Planner ----------

export interface RawPlannerTask {
  id: string; title: string; percentComplete: number; dueDateTime: string | null; assigneeIds: string[];
  description: string | null; detailsError?: string | null;
}
export interface PlannerItem { id: string; title: string; due: string | null; percent: 0 | 50 | 100; assignees: string[]; hash: string }

export function toPlannerItem(t: RawPlannerTask): PlannerItem {
  const percent = t.percentComplete >= 100 ? 100 : t.percentComplete <= 0 ? 0 : 50;
  const title = (t.title ?? "").trim().slice(0, 200) || "(zonder titel)";
  const due = t.dueDateTime ? t.dueDateTime.slice(0, 10) : null;
  const assignees = [...t.assigneeIds].map((x) => x.toLowerCase()).sort();
  return { id: t.id, title, due, percent, assignees, hash: JSON.stringify([title, due, percent, assignees]) };
}

// ---------- Poorten ----------

export interface Listing<T> { items: T[]; complete: boolean; error: string | null }
/** Alleen-lezen Microsoft-poort; heeft bewust geen schrijfmethoden. */
export interface ImportGraph {
  calendarView(userId: string, calendarId: string, fromIso: string, toIso: string): Promise<Listing<RawEvent>>;
  bucketTasks(bucketId: string): Promise<Listing<RawPlannerTask>>;
}
export interface ImportSettings {
  agenda_user_id: string | null; agenda_calendar_id: string | null; planner_mode: string;
  planner_general_bucket_id: string | null;
}
export interface ImportDb {
  settings(): Promise<ImportSettings>;
  linkedBuckets(): Promise<string[]>;
  applyAgenda(calendarId: string, items: AgendaItem[], complete: boolean, fromDate: string, toDate: string): Promise<Record<string, number>>;
  applyPlanner(bucketId: string, items: PlannerItem[], complete: boolean): Promise<Record<string, number>>;
}

export interface ImportResult {
  agenda: { status: "ok" | "partial" | "skipped" | "error"; detail: string | null; counts: Record<string, number> | null };
  planner: { bucket: string; status: "ok" | "partial" | "error"; detail: string | null; counts: Record<string, number> | null }[];
  plannerSkipped: string | null;
}

export async function runImport(graph: ImportGraph, db: ImportDb, now = new Date()): Promise<ImportResult> {
  const s = await db.settings();
  const out: ImportResult = { agenda: { status: "skipped", detail: "Geen bevestigde BCD-agenda", counts: null }, planner: [], plannerSkipped: null };

  if (s.agenda_calendar_id && s.agenda_user_id) {
    const w = agendaWindow(now);
    try {
      const l = await graph.calendarView(s.agenda_user_id, s.agenda_calendar_id, w.fromIso, w.toIso);
      const items: AgendaItem[] = [];
      let unconvertible = 0;
      const seen = new Set<string>();
      for (const e of l.items) {
        const it = toAgendaItem(e);
        if (!it) { if (e?.type !== "seriesMaster") unconvertible++; continue; }
        if (seen.has(it.event_id)) continue;
        seen.add(it.event_id); items.push(it);
      }
      // Afwezigheid alleen concluderen bij volledige lezing én zonder onzekere items.
      const complete = l.complete && !l.error && unconvertible === 0;
      const counts = items.length || complete ? await db.applyAgenda(s.agenda_calendar_id, items, complete, w.fromDate, w.toDate) : null;
      out.agenda = { status: complete ? "ok" : "partial", detail: l.error ?? (unconvertible ? `${unconvertible} afspraak/afspraken niet veilig om te zetten` : null), counts };
    } catch (e) {
      out.agenda = { status: "error", detail: e instanceof Error ? e.message : String(e), counts: null };
    }
  }

  if (s.planner_mode !== "import") { out.plannerSkipped = "Planner staat niet in leesmodus"; return out; }
  const buckets = [...new Set([...(await db.linkedBuckets()), ...(s.planner_general_bucket_id ? [s.planner_general_bucket_id] : [])])];
  if (!buckets.length) out.plannerSkipped = "Geen gekoppelde buckets";
  for (const b of buckets) {
    try {
      const l = await graph.bucketTasks(b);
      let unknown = 0;
      const items: PlannerItem[] = [];
      for (const t of l.items) {
        if (t.detailsError || t.description === null) { unknown++; continue; } // niet te classificeren: overslaan, geen conclusie
        if (skipForGenericPlanner(t)) continue; // Topical
        items.push(toPlannerItem(t));
      }
      const complete = l.complete && !l.error && unknown === 0;
      const counts = items.length || complete ? await db.applyPlanner(b, items, complete) : null;
      out.planner.push({ bucket: b, status: complete ? "ok" : "partial", detail: l.error ?? (unknown ? `${unknown} taak/taken zonder leesbare details` : null), counts });
    } catch (e) {
      out.planner.push({ bucket: b, status: "error", detail: e instanceof Error ? e.message : String(e), counts: null });
    }
  }
  return out;
}
