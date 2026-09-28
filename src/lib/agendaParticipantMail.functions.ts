import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertUuid,
  buildParticipantRecipients,
  runParticipantMail,
  type MailReport,
  type RecipientResult,
} from "./agendaParticipantMail";

/** Alleen beheerders (admin-rol), gecontroleerd als de ingelogde gebruiker zelf. */
async function isAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  return data === true;
}

async function loadRecipients(admin: any, eventId: string): Promise<RecipientResult> {
  const [{ data: regs, error: e1 }, { data: guests, error: e2 }] = await Promise.all([
    admin
      .from("agenda_registrations")
      .select("id, member_id, board_member_id, contact_email, contact_name, attendee_names")
      .eq("event_id", eventId),
    admin.from("agenda_guest_registrations").select("id, naam, email, status").eq("event_id", eventId),
  ]);
  if (e1 || e2) throw new Error("Deelnemers laden mislukt");

  const rows = (regs ?? []) as any[];
  const memberIds = [...new Set(rows.filter((r) => !r.contact_email && r.member_id != null).map((r) => r.member_id as number))];
  const boardIds = [...new Set(rows.filter((r) => r.board_member_id).map((r) => r.board_member_id as string))];

  const emailByMember = new Map<number, string>();
  if (memberIds.length) {
    const { data } = await admin.from("member_allowed_emails").select("member_id, email").in("member_id", memberIds);
    for (const row of (data ?? []) as { member_id: number; email: string }[]) {
      const e = (row.email ?? "").trim().toLowerCase();
      if (e && !emailByMember.has(row.member_id)) emailByMember.set(row.member_id, e);
    }
  }
  const emailByBoard = new Map<string, string>();
  const nameByBoard = new Map<string, string>();
  if (boardIds.length) {
    const { data } = await admin.from("board_members").select("id, naam, email, bond_email").in("id", boardIds);
    for (const row of (data ?? []) as any[]) {
      const e = String(row.bond_email || row.email || "").trim().toLowerCase();
      if (e) emailByBoard.set(row.id, e);
      if (row.naam) nameByBoard.set(row.id, row.naam);
    }
  }
  return buildParticipantRecipients({
    registrations: rows,
    guests: (guests ?? []) as any[],
    emailByMember,
    emailByBoard,
    nameByBoard,
  });
}

/** Voorbeeld van ontvangers (admin): aantal, adressen en ontbrekende/ongeldige. */
export const previewParticipantMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string }) => ({ eventId: assertUuid(d?.eventId, "evenement") }))
  .handler(async ({ data, context }): Promise<RecipientResult> => {
    if (!(await isAdmin(context))) throw new Error("Geen rechten");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return loadRecipients(supabaseAdmin, data.eventId);
  });

/** Verstuurt of hervat één verzending; ontvangers worden server-side bepaald. */
export const sendParticipantMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string; batchId: string; subject: string; body: string }) => d)
  .handler(async ({ data, context }): Promise<MailReport> => {
    const admin = await isAdmin(context);
    const { supabaseAdmin: db } = admin
      ? await import("@/integrations/supabase/client.server")
      : { supabaseAdmin: null as any };
    return runParticipantMail(
      {
        isAdmin: async () => admin,
        loadEvent: async (id) => {
          const { data: ev } = await db.from("agenda_events").select("id, title").eq("id", id).maybeSingle();
          return ev ?? null;
        },
        loadRecipients: (id) => loadRecipients(db, id),
        getBatch: async (id) => {
          const { data: b } = await db
            .from("agenda_participant_mail_batches")
            .select("event_id, subject, body")
            .eq("id", id)
            .maybeSingle();
          return b ?? null;
        },
        createBatch: async (b) => {
          const { error } = await db
            .from("agenda_participant_mail_batches")
            .insert({ ...b, created_by: context.userId });
          // Gelijktijdige dubbelklik: de ander heeft hem net aangemaakt; claim beschermt verder.
          if (error && error.code !== "23505") throw new Error("Verzending vastleggen mislukt");
        },
        claim: async (batchId, eventId, emails) => {
          if (!emails.length) return [];
          const { data: rows, error } = await db.rpc("agenda_claim_participant_mail", {
            _batch_id: batchId,
            _event_id: eventId,
            _emails: emails,
          });
          if (error) throw new Error("Claimen mislukt");
          return ((rows ?? []) as any[]).map((r) => (typeof r === "string" ? r : r.email));
        },
        send: async (a) => {
          const { data: res, error } = await db.functions.invoke("send-transactional-email", {
            body: {
              templateName: "agenda-participant-message",
              recipientEmail: a.email,
              idempotencyKey: a.idempotencyKey,
              templateData: {
                subject: a.subject,
                message: a.body,
                eventTitle: a.eventTitle,
                recipientName: a.naam,
              },
            },
          });
          if (error) return { status: "failed", note: "verzendfout" };
          if (res && res.success === false) return { status: "skipped", note: String(res.reason ?? "geweigerd") };
          return { status: "sent" };
        },
        mark: async (batchId, email, o) => {
          await db
            .from("agenda_participant_mail_sends")
            .update({ status: o.status, note: o.note ?? null })
            .eq("batch_id", batchId)
            .eq("email", email);
        },
        listStatuses: async (batchId) => {
          const { data: rows } = await db
            .from("agenda_participant_mail_sends")
            .select("email, status")
            .eq("batch_id", batchId);
          return (rows ?? []) as any[];
        },
      },
      data,
    );
  });
