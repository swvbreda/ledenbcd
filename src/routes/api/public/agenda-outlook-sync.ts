import { createFileRoute } from "@tanstack/react-router";

/**
 * Zet een evenement als afspraak in de Outlook-agenda van het secretariaat en
 * houdt de deelnemerslijst gelijk aan de aanmeldingen in de app.
 *
 * Wordt uitsluitend server-to-server aangeroepen (database-trigger via pg_net,
 * of de knop "Outlook bijwerken" via een beveiligde databasefunctie) en is
 * afgeschermd met het interne webhook-geheim.
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

export const Route = createFileRoute("/api/public/agenda-outlook-sync")({
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

        let eventId: string | null = null;
        const log: Record<string, unknown> = {
          started_at: new Date().toISOString(),
          status: "running",
          trigger: "agenda-outlook",
          details: {},
        };

        try {
          const body = (await request.json().catch(() => ({}))) as {
            event_id?: string;
            action?: string;
            outlook_event_id?: string;
          };
          eventId = body.event_id ?? null;
          const action = body.action ?? "sync";
          if (!eventId) return Response.json({ error: "event_id ontbreekt" }, { status: 400 });

          const { data: ev, error: evErr } = await supabaseAdmin
            .from("agenda_events")
            .select(
              "id, title, description, event_type, event_date, start_time, end_time, location, cancelled_at, outlook_event_id",
            )
            .eq("id", eventId)
            .maybeSingle();
          if (evErr) throw evErr;

          const token = await getAppToken();

          // --- Afspraak verwijderen (geannuleerd of item weg) -----------------
          if (action === "delete" || !ev || ev.cancelled_at) {
            const existingId = ev?.outlook_event_id ?? body.outlook_event_id ?? null;
            if (existingId) {
              await graph(
                token,
                "DELETE",
                `/users/${encodeURIComponent(mailbox)}/events/${existingId}`,
              ).catch((e: Error) => {
                if (!String(e.message).includes("404")) throw e;
              });
            }
            if (ev) {
              await supabaseAdmin
                .from("agenda_events")
                .update({
                  outlook_event_id: null,
                  outlook_synced_at: new Date().toISOString(),
                  outlook_error: null,
                })
                .eq("id", ev.id);
              await supabaseAdmin
                .from("agenda_registrations")
                .update({ outlook_state: "removed" })
                .eq("event_id", ev.id);
            }
            log["status"] = "success";
            log["finished_at"] = new Date().toISOString();
            log["details"] = { event_id: eventId, action: "delete", deleted: !!existingId };
            await supabaseAdmin.from("outlook_sync_log").insert(log as never);
            return Response.json({ ok: true, action: "delete", deleted: !!existingId });
          }

          if (ev.event_type !== "evenement") {
            return Response.json({ ok: true, skipped: "geen evenement" });
          }

          // --- Deelnemers bepalen --------------------------------------------
          const { data: regs, error: regErr } = await supabaseAdmin
            .from("agenda_registrations")
            .select("id, member_id, board_member_id, attendee_names, contact_name, contact_email")
            .eq("event_id", ev.id);
          if (regErr) throw regErr;

          const rows = (regs ?? []) as {
            id: string;
            member_id: number | null;
            board_member_id: string | null;
            attendee_names: string[] | null;
            contact_name: string | null;
            contact_email: string | null;
          }[];

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

          const attendees: {
            emailAddress: { address: string; name: string };
            type: string;
          }[] = [];
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

          // --- Afspraak aanmaken of bijwerken ---------------------------------
          const intro =
            `<p>Je aanmelding voor <strong>${ev.title}</strong> is bevestigd. ` +
            `Deze afspraak staat nu in je agenda.</p>`;
          const payload: Record<string, unknown> = {
            subject: `Bevestiging aanmelding — ${ev.title}`,
            body: {
              contentType: "HTML",
              content: intro + (ev.description ?? "").replace(/\n/g, "<br/>"),
            },
            ...eventTimes(ev),
            attendees,
            allowNewTimeProposals: false,
            // Deelnemers hebben zich al aangemeld: bevestiging, geen RSVP-vraag.
            responseRequested: false,
            isReminderOn: true,
          };
          if (ev.location) payload["location"] = { displayName: ev.location };

          let outlookId: string | null = ev.outlook_event_id ?? null;
          if (outlookId) {
            try {
              await graph(
                token,
                "PATCH",
                `/users/${encodeURIComponent(mailbox)}/events/${outlookId}`,
                payload,
              );
            } catch (e) {
              if (String((e as Error).message).includes("404")) outlookId = null;
              else throw e;
            }
          }
          if (!outlookId) {
            const created = await graph(
              token,
              "POST",
              `/users/${encodeURIComponent(mailbox)}/events`,
              payload,
            );
            outlookId = (created as { id?: string })?.id ?? null;
          }

          await supabaseAdmin
            .from("agenda_events")
            .update({
              outlook_event_id: outlookId,
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

          // Controle: staat de afspraak echt verzonden klaar bij Microsoft?
          let verify: Record<string, unknown> | null = null;
          if (outlookId) {
            try {
              const v = (await graph(
                token,
                "GET",
                `/users/${encodeURIComponent(mailbox)}/events/${outlookId}?$select=isDraft,responseRequested,attendees`,
              )) as {
                isDraft?: boolean;
                responseRequested?: boolean;
                attendees?: { emailAddress?: { address?: string }; status?: { response?: string } }[];
              };
              verify = {
                isDraft: v.isDraft ?? null,
                responseRequested: v.responseRequested ?? null,
                attendee_responses: (v.attendees ?? []).map((a) => [
                  a.emailAddress?.address ?? "",
                  a.status?.response ?? "",
                ]),
              };
            } catch (e) {
              verify = { verify_error: (e as Error).message };
            }
          }

          log["status"] = "success";
          log["finished_at"] = new Date().toISOString();
          log["details"] = {
            event_id: ev.id,
            outlook_event_id: outlookId,
            attendees: attendees.length,
            zonder_email: regUpdates.filter((u) => u.state === "no_email").length,
            verify,
          };
          await supabaseAdmin.from("outlook_sync_log").insert(log as never);

          return Response.json({ ok: true, attendees: attendees.length });
        } catch (e) {
          const message = (e as Error).message ?? "Onbekende fout";
          console.error("agenda-outlook-sync mislukt:", message);
          try {
            log["status"] = "error";
            log["finished_at"] = new Date().toISOString();
            log["details"] = { event_id: eventId, error: message };
            await supabaseAdmin.from("outlook_sync_log").insert(log as never);
            if (eventId) {
              await supabaseAdmin
                .from("agenda_events")
                .update({ outlook_error: message.slice(0, 500) })
                .eq("id", eventId);
            }
          } catch {
            // logfouten negeren
          }
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
