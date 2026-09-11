import { createFileRoute } from "@tanstack/react-router";

/**
 * Eenmalige inhaalactie: komende evenementen die al in Outlook staan, maar waar
 * nooit een uitnodiging is uitgegaan (aangemaakt zonder uitnodigingsverzoek),
 * opnieuw aanmaken mét uitnodigingsverzoek zodat alle aangemelde deelnemers
 * alsnog een agenda-uitnodiging van Microsoft ontvangen.
 *
 * Verstuurt géén e-mail vanuit het ledenportaal — alleen het agendaverzoek.
 * Server-to-server, beveiligd met het interne webhook-geheim.
 */

const TIMEZONE = "Europe/Amsterdam";

const clean = (t: string | null | undefined) => (t ? t.slice(0, 8).padEnd(8, "0") : null);

function eventTimes(ev: { event_date: string; start_time: string | null; end_time: string | null }) {
  const start = clean(ev.start_time) ?? "09:00:00";
  let end = clean(ev.end_time);
  if (!end || end <= start) {
    const [h, m] = start.split(":").map(Number);
    const total = (h ?? 9) * 60 + (m ?? 0) + 60;
    end = `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;
  }
  return {
    start: { dateTime: `${ev.event_date}T${start}`, timeZone: TIMEZONE },
    end: { dateTime: `${ev.event_date}T${end}`, timeZone: TIMEZONE },
  };
}

async function getAppToken(): Promise<string> {
  const tenant = process.env["MS_GRAPH_TENANT_ID"]?.trim();
  const clientId = process.env["MS_GRAPH_CLIENT_ID"]?.trim();
  const clientSecret = process.env["MS_GRAPH_CLIENT_SECRET"]?.trim();
  if (!tenant || !clientId || !clientSecret) throw new Error("Microsoft-koppeling niet ingesteld");

  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) throw new Error(`Token error ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function graph(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 403 || text.includes("Access is denied")) {
      console.error(`Outlook-agenda weigerde schrijven (${res.status}): ${text}`);
      throw new Error(
        "Outlook-agenda geeft nog geen toestemming — de beheerder moet dit eenmalig goedkeuren.",
      );
    }
    throw new Error(`Graph ${method} ${path} -> ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

type Reg = {
  id: string;
  member_id: number | null;
  board_member_id: string | null;
  attendee_names: string[] | null;
  contact_name: string | null;
  contact_email: string | null;
};

export const Route = createFileRoute("/api/public/agenda-outlook-backfill")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["INTERNAL_WEBHOOK_SECRET"] ?? "";
        const provided = request.headers.get("x-internal-secret") ?? "";
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const mailbox =
          process.env["AGENDA_OUTLOOK_MAILBOX"]?.trim() || "simone@coffeeshopbond.nl";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const body = (await request.json().catch(() => ({}))) as {
          dry_run?: boolean;
          event_ids?: string[];
        };
        const dryRun = body.dry_run === true;

        const today = new Date().toISOString().slice(0, 10);
        let query = supabaseAdmin
          .from("agenda_events")
          .select(
            "id, title, description, event_type, event_date, start_time, end_time, location, cancelled_at, outlook_event_id",
          )
          .gte("event_date", today)
          .is("cancelled_at", null)
          .eq("event_type", "evenement")
          .not("outlook_event_id", "is", null);
        if (body.event_ids?.length) query = query.in("id", body.event_ids);

        const { data: events, error: evErr } = await query;
        if (evErr) return Response.json({ error: evErr.message }, { status: 500 });

        const token = await getAppToken();
        const results: Record<string, unknown>[] = [];

        for (const ev of (events ?? []) as {
          id: string;
          title: string;
          description: string | null;
          event_date: string;
          start_time: string | null;
          end_time: string | null;
          location: string | null;
          outlook_event_id: string | null;
        }[]) {
          try {
            // 1. Huidige staat bij Microsoft ophalen.
            const current = (await graph(
              token,
              "GET",
              `/users/${encodeURIComponent(mailbox)}/events/${ev.outlook_event_id}?$select=id,responseRequested,attendees`,
            )) as {
              responseRequested?: boolean;
              attendees?: { status?: { response?: string } }[];
            };

            const anyResponse = (current.attendees ?? []).some(
              (a) => (a.status?.response ?? "none") !== "none",
            );
            if (current.responseRequested === true && anyResponse) {
              results.push({ event: ev.title, skipped: "uitnodigingen al bezorgd" });
              continue;
            }

            // 2. Deelnemers opnieuw opbouwen uit de aanmeldingen.
            const { data: regs } = await supabaseAdmin
              .from("agenda_registrations")
              .select("id, member_id, board_member_id, attendee_names, contact_name, contact_email")
              .eq("event_id", ev.id);
            const rows = (regs ?? []) as Reg[];

            const memberIds = [
              ...new Set(rows.map((r) => r.member_id).filter((v): v is number => v != null)),
            ];
            const boardIds = [
              ...new Set(rows.map((r) => r.board_member_id).filter((v): v is string => !!v)),
            ];

            const emailByMember = new Map<number, string>();
            if (memberIds.length) {
              const { data: allowed } = await supabaseAdmin
                .from("member_allowed_emails")
                .select("member_id, email")
                .in("member_id", memberIds);
              for (const row of (allowed ?? []) as { member_id: number; email: string }[]) {
                const e = (row.email ?? "").trim().toLowerCase();
                if (e && !emailByMember.has(row.member_id)) emailByMember.set(row.member_id, e);
              }
              const missing = memberIds.filter((id) => !emailByMember.has(id));
              if (missing.length) {
                const { data: mds } = await supabaseAdmin
                  .from("members_data")
                  .select("id, data")
                  .in("id", missing);
                for (const row of (mds ?? []) as { id: number; data: Record<string, unknown> }[]) {
                  const e = String((row.data as { email?: string })?.email ?? "")
                    .trim()
                    .toLowerCase();
                  if (e) emailByMember.set(row.id, e);
                }
              }
            }

            const emailByBoard = new Map<string, string>();
            const nameByBoard = new Map<string, string>();
            if (boardIds.length) {
              const { data: bms } = await supabaseAdmin
                .from("board_members")
                .select("id, naam, email, bond_email")
                .in("id", boardIds);
              for (const row of (bms ?? []) as {
                id: string;
                naam: string | null;
                email: string | null;
                bond_email: string | null;
              }[]) {
                const e = (row.bond_email || row.email || "").trim().toLowerCase();
                if (e) emailByBoard.set(row.id, e);
                if (row.naam) nameByBoard.set(row.id, row.naam);
              }
            }

            const attendees: { emailAddress: { address: string; name: string }; type: string }[] =
              [];
            const seen = new Set<string>();
            const regUpdates: { id: string; email: string | null; state: string }[] = [];

            for (const r of rows) {
              const chosen = (r.contact_email ?? "").trim().toLowerCase();
              const email = chosen
                ? chosen
                : r.board_member_id
                  ? emailByBoard.get(r.board_member_id) ?? null
                  : r.member_id != null
                    ? emailByMember.get(r.member_id) ?? null
                    : null;
              if (!email) {
                regUpdates.push({ id: r.id, email: null, state: "no_email" });
                continue;
              }
              regUpdates.push({ id: r.id, email, state: "invited" });
              if (seen.has(email)) continue;
              seen.add(email);
              const name =
                (r.contact_name ?? "").trim() ||
                (r.attendee_names ?? []).find((n) => n && n.trim()) ||
                (r.board_member_id ? nameByBoard.get(r.board_member_id) : null) ||
                email;
              attendees.push({ emailAddress: { address: email, name }, type: "required" });
            }

            if (attendees.length === 0) {
              results.push({ event: ev.title, skipped: "geen deelnemers met e-mailadres" });
              continue;
            }

            if (dryRun) {
              results.push({
                event: ev.title,
                would_invite: attendees.map((a) => a.emailAddress.address),
              });
              continue;
            }

            // 3. Oude afspraak weg, nieuwe afspraak mét uitnodigingsverzoek.
            const payload: Record<string, unknown> = {
              subject: ev.title,
              body: {
                contentType: "HTML",
                content: (ev.description ?? "").replace(/\n/g, "<br/>"),
              },
              ...eventTimes(ev),
              attendees,
              allowNewTimeProposals: false,
              responseRequested: true,
              isReminderOn: true,
            };
            if (ev.location) payload["location"] = { displayName: ev.location };

            await graph(
              token,
              "DELETE",
              `/users/${encodeURIComponent(mailbox)}/events/${ev.outlook_event_id}`,
            ).catch((e: Error) => {
              if (!String(e.message).includes("404")) throw e;
            });

            const created = (await graph(
              token,
              "POST",
              `/users/${encodeURIComponent(mailbox)}/events`,
              payload,
            )) as { id?: string };
            const newId = created?.id ?? null;

            await supabaseAdmin
              .from("agenda_events")
              .update({
                outlook_event_id: newId,
                outlook_synced_at: new Date().toISOString(),
                outlook_error: null,
              })
              .eq("id", ev.id);

            for (const u of regUpdates) {
              await supabaseAdmin
                .from("agenda_registrations")
                .update({
                  outlook_attendee_email: u.email,
                  outlook_state: u.state,
                  outlook_error:
                    u.state === "no_email" ? "Geen e-mailadres bekend voor deze deelnemer" : null,
                })
                .eq("id", u.id);
            }

            // 4. Verificatie bij Microsoft.
            let verify: Record<string, unknown> | null = null;
            if (newId) {
              try {
                const v = (await graph(
                  token,
                  "GET",
                  `/users/${encodeURIComponent(mailbox)}/events/${newId}?$select=isDraft,responseRequested,attendees`,
                )) as {
                  isDraft?: boolean;
                  responseRequested?: boolean;
                  attendees?: unknown[];
                };
                verify = {
                  isDraft: v.isDraft ?? null,
                  responseRequested: v.responseRequested ?? null,
                  attendees: (v.attendees ?? []).length,
                };
              } catch (e) {
                verify = { verify_error: (e as Error).message };
              }
            }

            results.push({
              event: ev.title,
              event_id: ev.id,
              outlook_event_id: newId,
              invited: attendees.length,
              verify,
            });
          } catch (e) {
            results.push({ event: ev.title, event_id: ev.id, error: (e as Error).message });
          }
        }

        await supabaseAdmin.from("outlook_sync_log").insert({
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          status: results.some((r) => r["error"]) ? "partial" : "success",
          trigger: "agenda-outlook-backfill",
          details: { dry_run: dryRun, results },
        } as never);

        return Response.json({ ok: true, dry_run: dryRun, results });
      },
    },
  },
});
