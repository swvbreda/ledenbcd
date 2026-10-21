/** Server-only, alleen-lezen Graph-poort voor de eenrichtingsimport. Elke aanroep is GET. */
import { GraphError, safeMsg } from "@/lib/plannerSync";
import { GRAPH_ORIGIN, mapLimit } from "@/lib/plannerGraph.server";
import type { ImportGraph, Listing, RawEvent, RawPlannerTask } from "@/lib/msImport";

type Req = (method: string, path: string, body?: unknown, ifMatch?: string, prefer?: string) => Promise<{ json: any; etag: string | null }>;
export interface ReadOnlyGraph { get(path: string, prefer?: string): Promise<{ json: any }> }

/** Verpakt een Graph-client zodat alleen GET mogelijk is. */
export function readOnlyGraph(c: { req: Req }): ReadOnlyGraph {
  return { get: (path, prefer) => c.req("GET", path, undefined, undefined, prefer) };
}

const GUID = /^[0-9a-fA-F-]{36}$/;
const BUCKET = /^[A-Za-z0-9_-]{1,100}$/;
const MAX_PAGES = 20;
const TZ = 'outlook.timezone="Europe/Amsterdam"';
const EVENT_FIELDS = "id,subject,start,end,isAllDay,location,onlineMeeting,iCalUId,seriesMasterId,type,originalStart,isCancelled,lastModifiedDateTime";

/** Neemt alleen de paginatietoken uit nextLink over en bouwt zelf het vaste pad op. */
export function nextPageParams(nextLink: unknown): URLSearchParams | null {
  if (typeof nextLink !== "string") return null;
  const u = new URL(nextLink);
  if (u.origin !== GRAPH_ORIGIN) throw new GraphError(0, "Niet-toegestane vervolgpagina");
  const out = new URLSearchParams();
  for (const k of ["$skip", "$skiptoken", "$deltatoken"]) { const v = u.searchParams.get(k); if (v) out.set(k, v); }
  if (![...out.keys()].length) throw new GraphError(0, "Vervolgpagina zonder herkenbare token");
  return out;
}

async function pages<T>(g: ReadOnlyGraph, base: string, params: URLSearchParams, prefer?: string): Promise<Listing<T>> {
  const items: T[] = [];
  let extra: URLSearchParams | null = new URLSearchParams();
  for (let i = 0; extra; i++) {
    if (i >= MAX_PAGES) return { items, complete: false, error: "Te veel pagina's; niet volledig gelezen" };
    const q = new URLSearchParams(params);
    extra.forEach((v, k) => q.set(k, v));
    try {
      const { json } = await g.get(`${base}?${q.toString()}`, prefer);
      items.push(...((json.value ?? []) as T[]));
      extra = nextPageParams(json["@odata.nextLink"]);
    } catch (e) {
      return { items, complete: false, error: safeMsg(e) };
    }
  }
  return { items, complete: true, error: null };
}

export function importGraphPort(g: ReadOnlyGraph): ImportGraph & {
  resolveUser(mailbox: string): Promise<string>;
  listCalendars(userId: string): Promise<{ id: string; name: string; isDefault: boolean }[]>;
} {
  return {
    async resolveUser(mailbox) {
      const { json } = await g.get(`/users/${encodeURIComponent(mailbox)}?$select=id`);
      if (!GUID.test(String(json.id ?? ""))) throw new GraphError(0, "Microsoft-account niet gevonden");
      return String(json.id).toLowerCase();
    },
    async listCalendars(userId) {
      if (!GUID.test(userId)) throw new GraphError(0, "Ongeldig account");
      const l = await pages<{ id: string; name: string; isDefaultCalendar?: boolean }>(g, `/users/${userId}/calendars`, new URLSearchParams({ $select: "id,name,isDefaultCalendar", $top: "50" }));
      if (l.error) throw new GraphError(0, l.error);
      return l.items.map((c) => ({ id: c.id, name: c.name, isDefault: c.isDefaultCalendar !== false }));
    },
    async calendarView(userId, calendarId, fromIso, toIso) {
      if (!GUID.test(userId) || !calendarId) throw new GraphError(0, "Ongeldige agenda");
      return pages<RawEvent>(g, `/users/${userId}/calendars/${encodeURIComponent(calendarId)}/calendarView`,
        new URLSearchParams({ startDateTime: fromIso, endDateTime: toIso, $select: EVENT_FIELDS, $top: "100" }), TZ);
    },
    async bucketTasks(bucketId) {
      if (!BUCKET.test(bucketId)) throw new GraphError(0, "Ongeldige bucket");
      type T = { id: string; title: string; percentComplete?: number; dueDateTime?: string | null; assignments?: Record<string, unknown>; bucketId?: string };
      const l = await pages<T>(g, `/planner/buckets/${bucketId}/tasks`, new URLSearchParams({ $top: "100" }));
      const items = await mapLimit(l.items.filter((t) => !t.bucketId || t.bucketId === bucketId), 4, async (t): Promise<RawPlannerTask> => {
        const base = { id: t.id, title: t.title, percentComplete: t.percentComplete ?? 0, dueDateTime: t.dueDateTime ?? null, assigneeIds: Object.keys(t.assignments ?? {}) };
        try { const { json } = await g.get(`/planner/tasks/${t.id}/details?$select=description`); return { ...base, description: (json.description ?? "") as string }; }
        catch (e) { return { ...base, description: null, detailsError: safeMsg(e) }; }
      });
      return { items, complete: l.complete, error: l.error };
    },
  };
}
