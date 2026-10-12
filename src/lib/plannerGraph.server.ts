/** Server-only Microsoft Graph-adapter voor Planner. Tokens verlaten deze module nooit. */
import { GraphError, safeMsg, type GraphPort, type RemoteTask } from "@/lib/plannerSync";

export const GRAPH_ORIGIN = "https://graph.microsoft.com";
const BASE = `${GRAPH_ORIGIN}/v1.0`;
const ALLOWED = [
  /^\/planner\/plans\/[A-Za-z0-9_-]+(\/tasks)?(\?.*)?$/,
  /^\/planner\/tasks(\/[A-Za-z0-9_-]+(\/details)?)?(\?.*)?$/,
  /^\/groups\/[0-9a-fA-F-]{36}(\/planner\/plans)?(\?.*)?$/,
  /^\/groups\?.*$/,
  /^\/users\/[^/?#]+(\?.*)?$/,
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

export function makeGraphClient(token: string, f: Fetch = fetch, opts: { maxRetries?: number; timeoutMs?: number; sleepFn?: (ms: number) => Promise<void> } = {}) {
  const maxRetries = opts.maxRetries ?? 3, timeoutMs = opts.timeoutMs ?? 15_000, wait = opts.sleepFn ?? sleep;
  async function req(method: string, pathOrUrl: string, body?: unknown, ifMatch?: string, prefer?: string) {
    const url = assertGraphUrl(pathOrUrl);
    for (let attempt = 0; ; attempt++) {
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
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries && (method !== "POST" || res.status === 429 || res.status === 503)) {
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
  assignments?: Record<string, unknown>; createdBy?: { application?: { id?: string } }; createdDateTime?: string;
  details?: { description?: string; "@odata.etag"?: string };
};

export function plannerPort(c: ReturnType<typeof makeGraphClient>): GraphPort {
  return {
    async listPlanTasks(planId) {
      const raw = await c.list<RawTask>(`/planner/plans/${planId}/tasks?$expand=details`);
      return raw.map((t): RemoteTask => ({
        id: t.id, etag: t["@odata.etag"], title: t.title, percentComplete: t.percentComplete ?? 0, priority: t.priority ?? null,
        dueDateTime: t.dueDateTime ?? null, assigneeIds: Object.keys(t.assignments ?? {}),
        createdByAppId: t.createdBy?.application?.id ?? null, createdDateTime: t.createdDateTime ?? null,
        description: t.details?.description ?? null, detailsEtag: t.details?.["@odata.etag"] ?? null,
      }));
    },
    async getDetails(id) {
      const { json } = await c.req("GET", `/planner/tasks/${id}/details`);
      return { description: json.description ?? null, etag: json["@odata.etag"] };
    },
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
  };
}
