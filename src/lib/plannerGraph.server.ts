/** Server-only Microsoft Graph-adapter voor Planner. Tokens verlaten deze module nooit. */
import { GraphError, safeMsg, type GraphPort, type RemoteTask } from "@/lib/plannerSync";

export const GRAPH_ORIGIN = "https://graph.microsoft.com";
const BASE = `${GRAPH_ORIGIN}/v1.0`;
const ALLOWED = [
  // Deadline items: explicit Entra account + known calendar/event ids only.
  /^\/users\/[0-9a-fA-F-]{36}\/calendar(\?.*)?$/,
  // Eenrichtingsimport: kalenderlijst en calendarView van één expliciet bevestigde agenda (alleen GET).
  /^\/users\/[0-9a-fA-F-]{36}\/calendars(\?.*)?$/,
  /^\/users\/[0-9a-fA-F-]{36}\/calendars\/[A-Za-z0-9_%=+-]+\/calendarView\?.*$/,
  /^\/users\/[0-9a-fA-F-]{36}\/calendars\/[A-Za-z0-9_%=+-]+\/events(\/[A-Za-z0-9_%=+-]+)?(\?.*)?$/,
  /^\/planner\/plans\/[A-Za-z0-9_-]+(\/buckets)?(\?.*)?$/,
  /^\/planner\/buckets(\/[A-Za-z0-9_-]+(\/tasks)?)?(\?.*)?$/,
  /^\/planner\/tasks(\/[A-Za-z0-9_-]+(\/details)?)?(\?.*)?$/,
  /^\/groups\/[0-9a-fA-F-]{36}(\/planner\/plans)?(\?.*)?$/,
  /^\/groups\?.*$/,
  /^\/users\/[^/?#]+(\?.*)?$/,
  // Microsoft To Do van één expliciet bevestigd account (Entra-GUID), alleen lijsten/taken.
  /^\/users\/[0-9a-fA-F-]{36}\/todo\/lists(\/[A-Za-z0-9_=-]+(\/tasks(\/[A-Za-z0-9_=-]+)?)?)?(\?.*)?$/,
  // Projectmail: alleen inbox-delta en één bericht van één vast account (Entra-GUID), alleen GET via readOnlyGraph.
  /^\/users\/[0-9a-fA-F-]{36}\/mailFolders\/inbox\/messages\/delta\?.*$/,
  /^\/users\/[0-9a-fA-F-]{36}\/messages\/[A-Za-z0-9_%=+-]+\?\$select=[a-zA-Z,]+$/,
  /^\/users\/[0-9a-fA-F-]{36}\/mailFolders\/inbox\/messages\?\$top=1&\$select=id$/,
];

/** Alleen vaste Microsoft-origin en toegestane paden; nextLink ook gecontroleerd. */
export function assertGraphUrl(pathOrUrl: string): string {
  let path = pathOrUrl;
  if (/^https?:/i.test(pathOrUrl)) {
    const u = new URL(pathOrUrl);
    if (u.origin !== GRAPH_ORIGIN || !u.pathname.startsWith("/v1.0/")) throw new GraphError(0, "Niet-toegestane Graph-URL");
    path = u.pathname.slice("/v1.0".length) + u.search;
  }
  if (!ALLOWED.some((re) => re.test(path))) throw new GraphError(0, "Niet-toegestaan Graph-pad");
  return BASE + path;
}

export interface GraphConfig { tenant: string; clientId: string; clientSecret: string }
export function readGraphConfig(env: Record<string, string | undefined>): GraphConfig | null {
  const tenant = env["MS_GRAPH_TENANT_ID"]?.trim(), clientId = env["MS_GRAPH_CLIENT_ID"]?.trim(), clientSecret = env["MS_GRAPH_CLIENT_SECRET"]?.trim();
  return tenant && clientId && clientSecret ? { tenant, clientId, clientSecret } : null;
}

type Fetch = typeof fetch;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function getAppToken(cfg: GraphConfig, f: Fetch = fetch): Promise<{ token: string; roles: string[] }> {
  if (!/^[A-Za-z0-9.-]+$/.test(cfg.tenant)) throw new GraphError(0, "Ongeldige tenant");
  const res = await f(`https://login.microsoftonline.com/${cfg.tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, scope: `${GRAPH_ORIGIN}/.default`, grant_type: "client_credentials" }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new GraphError(res.status, `Microsoft-aanmelding mislukt (${res.status}${j.error ? ` ${j.error}` : ""})`);
  }
  const token = ((await res.json()) as { access_token: string }).access_token;
  return { token, roles: tokenRoles(token) };
}

/** Leest alleen de namen van applicatierechten uit het token. */
export function tokenRoles(token: string): string[] {
  try {
    const p = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return Array.isArray(p.roles) ? [...p.roles].map(String).sort() : [];
  } catch { return []; }
}

export function makeGraphClient(token: string, f: Fetch = fetch, opts: { maxRetries?: number; timeoutMs?: number; sleepFn?: (ms: number) => Promise<void>; deadlineAt?: number } = {}) {
  const maxRetries = opts.maxRetries ?? 3, timeoutMs = opts.timeoutMs ?? 15_000, wait = opts.sleepFn ?? sleep;
  async function req(method: string, pathOrUrl: string, body?: unknown, ifMatch?: string, prefer?: string) {
    const url = assertGraphUrl(pathOrUrl);
    for (let attempt = 0; ; attempt++) {
      // Harde einddatum: geen nieuw verzoek meer (ook geen retry/paginering); POST is dan zeker niet verstuurd.
      if (opts.deadlineAt && Date.now() >= opts.deadlineAt) throw new GraphError(0, "Maximale synchronisatieduur bereikt", false);
      let res: Response;
      try {
        res = await f(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(ifMatch ? { "If-Match": ifMatch } : {}),
            ...(prefer ? { Prefer: prefer } : {}),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        // Netwerk/timeout: bij lezen opnieuw, bij aanmaken onzeker (kan toch gelukt zijn).
        if (method === "GET" && attempt < maxRetries) { await wait(500 * 2 ** attempt); continue; }
        throw new GraphError(0, `Geen antwoord van Microsoft (${safeMsg(e)})`, method === "POST");
      }
      // POST alleen herhalen bij 429 (Microsoft heeft het verzoek zeker geweigerd); 5xx bij POST blijft onzeker.
      if ((res.status === 429 || (res.status >= 500 && method !== "POST")) && attempt < maxRetries) {
        const ra = Number(res.headers.get("Retry-After"));
        await wait(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 30) * 1000 : 500 * 2 ** attempt);
        continue;
      }
      const text = await res.text();
      if (!res.ok) {
        let code = "";
        try { code = (JSON.parse(text) as { error?: { code?: string } }).error?.code ?? ""; } catch { /* leeg */ }
        throw new GraphError(res.status, `Microsoft ${res.status}${code ? ` ${code}` : ""}`, method === "POST" && res.status >= 500);
      }
      return { json: text ? JSON.parse(text) : {}, etag: res.headers.get("ETag") };
    }
  }
  async function list<T>(path: string, max = 50): Promise<T[]> {
    const out: T[] = [];
    let next: string | null = path;
    for (let i = 0; next && i < max; i++) {
      const { json } = await req("GET", next);
      out.push(...((json.value ?? []) as T[]));
      next = typeof json["@odata.nextLink"] === "string" ? json["@odata.nextLink"] : null;
    }
    return out;
  }
  return { req, list };
}

type RawTask = {
  id: string; "@odata.etag": string; title: string; percentComplete: number; priority?: number; dueDateTime?: string | null;
  bucketId?: string; assignments?: Record<string, unknown>; createdBy?: { application?: { id?: string } }; createdDateTime?: string;
};

/** Begrensde paralleliteit voor detail-aanroepen. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

export function plannerPort(c: ReturnType<typeof makeGraphClient>, opts: { detailsConcurrency?: number } = {}): GraphPort & {
  getPlan(planId: string): Promise<{ id: string; title: string | null; groupId: string | null }>;
  listBuckets(planId: string): Promise<{ id: string; name: string }[]>;
  createBucket(planId: string, name: string): Promise<{ id: string; name: string }>;
} {
  const getDetails = async (id: string) => {
    const r = await c.req("GET", `/planner/tasks/${id}/details`);
    const etag = r.json["@odata.etag"] ?? r.etag;
    if (!etag) throw new GraphError(0, "ETag van taakdetails ontbreekt");
    return { description: (r.json.description ?? "") as string, etag: etag as string };
  };
  return {
    async listBucketTasks(bucketId) {
      // Standaard v1-endpoint; details worden per taak expliciet opgehaald (geen $expand).
      const raw = await c.list<RawTask>(`/planner/buckets/${bucketId}/tasks`);
      return mapLimit(raw, opts.detailsConcurrency ?? 4, async (t): Promise<RemoteTask> => {
        const base: RemoteTask = {
          id: t.id, etag: t["@odata.etag"], title: t.title, percentComplete: t.percentComplete ?? 0, priority: t.priority ?? null,
          dueDateTime: t.dueDateTime ?? null, assigneeIds: Object.keys(t.assignments ?? {}), bucketId: t.bucketId ?? null,
          createdByAppId: t.createdBy?.application?.id ?? null, createdDateTime: t.createdDateTime ?? null,
          description: null, detailsEtag: null, detailsError: null,
        };
        try { const d = await getDetails(t.id); return { ...base, description: d.description, detailsEtag: d.etag }; }
        catch (e) { return { ...base, detailsError: safeMsg(e) }; }
      });
    },
    getDetails,
    async createTask(body) {
      const { json } = await c.req("POST", "/planner/tasks", body);
      return { id: json.id, etag: json["@odata.etag"] };
    },
    async patchTask(id, etag, body) {
      const r = await c.req("PATCH", `/planner/tasks/${id}`, body, etag, "return=representation");
      return { etag: r.json["@odata.etag"] ?? r.etag };
    },
    async patchDetails(id, etag, body) {
      const r = await c.req("PATCH", `/planner/tasks/${id}/details`, body, etag, "return=representation");
      return { etag: r.json["@odata.etag"] ?? r.etag };
    },
    async getPlan(planId) {
      const { json } = await c.req("GET", `/planner/plans/${planId}?$select=id,title,container,owner`);
      const g = json.container?.type === "group" || !json.container ? (json.container?.containerId ?? json.owner ?? null) : null;
      return { id: json.id, title: json.title ?? null, groupId: g ? String(g).toLowerCase() : null };
    },
    async listBuckets(planId) {
      const rows = await c.list<{ id: string; name: string }>(`/planner/plans/${planId}/buckets`, 10);
      return rows.map((b) => ({ id: b.id, name: b.name }));
    },
    async createBucket(planId, name) {
      const { json } = await c.req("POST", "/planner/buckets", { name, planId, orderHint: " !" });
      return { id: json.id, name: json.name };
    },
  };
}

type RawTodo = { id: string; "@odata.etag"?: string; title?: string; status?: string; body?: { content?: string }; linkedResources?: { applicationName?: string; externalId?: string; webUrl?: string }[]; dueDateTime?: { dateTime?: string } | null };
const asTodo = (t: RawTodo) => ({
  id: t.id, title: t.title ?? "", status: t.status ?? "", etag: t["@odata.etag"] ?? "",
  body: t.body?.content ?? "",
  due: t.dueDateTime?.dateTime?.slice(0, 10) ?? null,
  linkedResources: (t.linkedResources ?? []).map((l) => ({ applicationName: String(l.applicationName ?? ""), externalId: String(l.externalId ?? ""), webUrl: String(l.webUrl ?? "") })),
});
const ID = /^[A-Za-z0-9_=-]+$/;
function todoPath(userId: string, listId?: string, taskId?: string) {
  if (!/^[0-9a-fA-F-]{36}$/.test(userId) || (listId && !ID.test(listId)) || (taskId && !ID.test(taskId))) throw new GraphError(0, "Ongeldige To Do-id");
  return `/users/${userId}/todo/lists${listId ? `/${listId}/tasks${taskId ? `/${taskId}` : ""}` : ""}`;
}

/** Microsoft To Do (app-only, vereist Tasks.Read.All / Tasks.ReadWrite.All). */
export function todoPort(c: ReturnType<typeof makeGraphClient>) {
  return {
    async listLists(userId: string) {
      const rows = await c.list<{ id: string; displayName: string; wellknownListName?: string }>(todoPath(userId), 10);
      return rows.map((r) => ({ id: r.id, name: r.displayName, wellknown: r.wellknownListName ?? null }));
    },
    async listTasks(userId: string, listId: string) {
      const rows = await c.list<RawTodo>(`${todoPath(userId, listId)}?$expand=linkedResources&$top=100`, 30);
      return rows.map(asTodo);
    },
    async getTodo(userId: string, listId: string, taskId: string) {
      const { json, etag } = await c.req("GET", `${todoPath(userId, listId, taskId)}?$expand=linkedResources`);
      const t = asTodo(json as RawTodo);
      if (!t.etag && etag) t.etag = etag;
      if (!t.etag) throw new GraphError(0, "ETag van To Do-taak ontbreekt");
      return t;
    },
    async completeTodo(userId: string, listId: string, taskId: string, etag: string) {
      await c.req("PATCH", todoPath(userId, listId, taskId), { status: "completed" }, etag);
    },
  };
}
