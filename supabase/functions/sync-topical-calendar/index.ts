import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const TENANT_ID = Deno.env.get("MS_GRAPH_TENANT_ID")?.trim()!;
const CLIENT_ID = Deno.env.get("MS_GRAPH_CLIENT_ID")?.trim()!;
const CLIENT_SECRET = Deno.env.get("MS_GRAPH_CLIENT_SECRET")?.trim()!;

// Postbus waar Topical de afspraken in zet (Outlook-koppeling in Topical).
const DEFAULT_MAILBOX = "simone@coffeeshopbond.nl";

const TOPICAL_URL_RE = /https?:\/\/[^\s"'<>)]*topical[^\s"'<>)]*/i;

async function getAppToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Token error ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token;
}

async function graphAll(token: string, path: string): Promise<any[]> {
  const out: any[] = [];
  let url: string | null = `https://graph.microsoft.com/v1.0${path}`;
  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="Europe/Amsterdam"' },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Graph ${url} -> ${res.status}: ${text}`);
    const json = JSON.parse(text);
    out.push(...(json.value || []));
    url = json["@odata.nextLink"] || null;
  }
  return out;
}

function findTopicalUrl(ev: any): string | null {
  const candidates = [
    ev?.onlineMeeting?.joinUrl,
    ev?.onlineMeetingUrl,
    ev?.location?.displayName,
    ev?.locations?.[0]?.displayName,
    ev?.body?.content,
    ev?.bodyPreview,
  ];
  for (const c of candidates) {
    if (typeof c !== "string" || !c) continue;
    const m = c.match(TOPICAL_URL_RE);
    if (m) return m[0].replace(/&amp;/g, "&");
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const INTERNAL_WEBHOOK_SECRET = Deno.env.get("INTERNAL_WEBHOOK_SECRET") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const internalSecret = req.headers.get("x-internal-secret") ?? "";
  const isServiceRole = SERVICE_ROLE_KEY && authHeader === `Bearer ${SERVICE_ROLE_KEY}`;
  const isInternal = INTERNAL_WEBHOOK_SECRET && internalSecret === INTERNAL_WEBHOOK_SECRET;
  if (!isServiceRole && !isInternal) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const logRow: Record<string, any> = {
    started_at: new Date().toISOString(),
    status: "running",
    trigger: "topical-calendar",
    details: {},
  };

  try {
    const body = await req.json().catch(() => ({}));
    const mailbox = (body?.mailbox || DEFAULT_MAILBOX).toString().trim();

    if (!TENANT_ID || !CLIENT_ID || !CLIENT_SECRET) {
      throw new Error("Missing MS_GRAPH_* secrets");
    }

    const token = await getAppToken();

    const start = new Date();
    start.setDate(start.getDate() - 7);
    const end = new Date();
    end.setDate(end.getDate() + 120);

    const path =
      `/users/${encodeURIComponent(mailbox)}/calendarView` +
      `?startDateTime=${start.toISOString()}&endDateTime=${end.toISOString()}` +
      `&$select=id,subject,start,end,location,locations,onlineMeeting,onlineMeetingUrl,bodyPreview,body,isCancelled` +
      `&$top=100`;

    let events: any[];
    try {
      events = await graphAll(token, path);
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("403") || msg.includes("Access is denied")) {
        throw new Error(
          "Geen toegang tot de Outlook-agenda. De Azure app-registratie heeft de application permission 'Calendars.Read' nodig (met admin consent).",
        );
      }
      throw e;
    }

    // Alleen afspraken met een Topical-link zijn relevant.
    const topical = events
      .filter((e) => !e.isCancelled)
      .map((e) => ({ ev: e, url: findTopicalUrl(e) }))
      .filter((x) => !!x.url);

    const { data: agendaEvents, error: agendaErr } = await supabase
      .from("agenda_events")
      .select("id, event_date, event_type, meeting_url, external_event_id")
      .gte("event_date", start.toISOString().slice(0, 10));
    if (agendaErr) throw agendaErr;

    let updated = 0;
    const unmatched: string[] = [];

    for (const { ev, url } of topical) {
      const startLocal: string = ev.start?.dateTime ?? "";
      const day = startLocal.slice(0, 10);
      if (!day) continue;

      const match =
        (agendaEvents ?? []).find((a: any) => a.external_event_id === ev.id) ??
        (agendaEvents ?? []).find(
          (a: any) => a.event_date === day && a.event_type === "bestuursvergadering",
        );

      if (!match) {
        unmatched.push(`${day}: ${ev.subject ?? "(geen titel)"}`);
        continue;
      }

      const { error: upErr } = await supabase
        .from("agenda_events")
        .update({
          meeting_url: url,
          external_source: "topical",
          external_event_id: ev.id,
          external_synced_at: new Date().toISOString(),
        })
        .eq("id", match.id);
      if (upErr) throw upErr;
      updated++;
    }

    logRow.status = "success";
    logRow.finished_at = new Date().toISOString();
    logRow.details = {
      mailbox,
      calendar_events: events.length,
      topical_events: topical.length,
      updated,
      unmatched,
    };
    await supabase.from("outlook_sync_log").insert(logRow);

    return new Response(JSON.stringify({ ok: true, ...logRow.details }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    logRow.status = "error";
    logRow.finished_at = new Date().toISOString();
    logRow.details = { error: (e as Error).message };
    try {
      await supabase.from("outlook_sync_log").insert(logRow);
    } catch (_) {
      // negeer log-fouten
    }
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
