import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  assertUuid,
  buildParticipantRecipients,
  interpretSendResponse,
  RecipientsChangedError,
  runParticipantMail,
  type MailDeps,
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

  const emailsByMember = new Map<number, string[]>();
  if (memberIds.length) {
    const { data, error } = await admin.from("member_allowed_emails").select("member_id, email").in("member_id", memberIds);
    if (error) throw new Error("Contactadressen van leden laden mislukt");
    for (const row of (data ?? []) as { member_id: number; email: string }[]) {
      const list = emailsByMember.get(row.member_id) ?? [];
      list.push(row.email ?? "");
      emailsByMember.set(row.member_id, list);
    }
  }
  const emailByBoard = new Map<string, string>();
  const nameByBoard = new Map<string, string>();
  if (boardIds.length) {
    const { data, error } = await admin.from("board_members").select("id, naam, email, bond_email").in("id", boardIds);
    if (error) throw new Error("Bestuursleden laden mislukt");
    for (const row of (data ?? []) as any[]) {
      const e = String(row.bond_email || row.email || "").trim().toLowerCase();
      if (e) emailByBoard.set(row.id, e);
      if (row.naam) nameByBoard.set(row.id, row.naam);
    }
  }
  return buildParticipantRecipients({
    registrations: rows,
    guests: (guests ?? []) as any[],
    emailsByMember,
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

function makeDeps(db: any, admin: boolean, userId: string): MailDeps {
  return {
    isAdmin: async () => admin,
    loadEvent: async (id) => {
      const { data: ev, error } = await db.from("agenda_events").select("id, title").eq("id", id).maybeSingle();
      if (error) throw new Error("Evenement laden mislukt");
      return ev ?? null;
    },
    loadRecipients: (id) => loadRecipients(db, id),
    getBatch: async (id) => {
      const { data: b, error } = await db
        .from("agenda_participant_mail_batches")
        .select("id, event_id, subject, body")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error("Verzending laden mislukt");
      return b ?? null;
    },
    createBatch: async (b, snapshot) => {
      const { error } = await db.rpc("agenda_create_participant_mail_batch", {
        _batch_id: b.id,
        _event_id: b.event_id,
        _subject: b.subject,
        _body: b.body,
        _created_by: userId,
        _recipients: snapshot.map((r) => ({ email: r.email, naam: r.naam })),
      });
      if (error) throw new Error("Verzending vastleggen mislukt");
    },
    claim: async (batchId, stillActive) => {
      const { data: rows, error } = await db.rpc("agenda_claim_participant_mail", {
        _batch_id: batchId,
        _still_active: stillActive,
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
      const status = (error as any)?.context?.status as number | undefined;
      return interpretSendResponse(res, error ? { status, message: error.message } : null);
    },
    mark: async (batchId, email, o) => {
      const { error } = await db
        .from("agenda_participant_mail_sends")
        .update({ status: o.status, note: o.note ?? null })
        .eq("batch_id", batchId)
        .eq("email", email);
      if (error) throw new Error(`Status vastleggen mislukt voor ${email}`);
    },
    listStatuses: async (batchId) => {
      const { data: rows, error } = await db
        .from("agenda_participant_mail_sends")
        .select("email, naam, status, note")
        .eq("batch_id", batchId)
        .order("email");
      if (error) throw new Error("Verzendstatus laden mislukt");
      return (rows ?? []) as any[];
    },
  };
}

/** Verstuurt of hervat één verzending; ontvangers worden server-side bepaald. */
export const sendParticipantMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { eventId: string; batchId: string; subject: string; body: string; expectedEmails?: string[] }) => ({
      eventId: String(d?.eventId ?? ""),
      batchId: String(d?.batchId ?? ""),
      subject: String(d?.subject ?? ""),
      body: String(d?.body ?? ""),
      expectedEmails: Array.isArray(d?.expectedEmails) ? d.expectedEmails.map(String).slice(0, 5000) : undefined,
    }),
  )
  .handler(async ({ data, context }): Promise<MailReport> => {
    const admin = await isAdmin(context);
    if (!admin) throw new Error("Geen toegang");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    try {
      return await runParticipantMail(makeDeps(db, admin, context.userId), data);
    } catch (e) {
      if (e instanceof RecipientsChangedError)
        throw new Error(`${e.message} Nieuw: ${e.added.length}, vervallen: ${e.removed.length}.`);
      throw e;
    }
  });

/** Alleen-lezen herstelstatus van een bestaande verzending (zonder te versturen). */
export const getParticipantMailStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string; batchId: string }) => ({
    eventId: assertUuid(d?.eventId, "evenement"),
    batchId: assertUuid(d?.batchId, "batchId"),
  }))
  .handler(async ({ data, context }) => {
    if (!(await isAdmin(context))) throw new Error("Geen toegang");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const deps = makeDeps(db, true, context.userId);
    const batch = await deps.getBatch(data.batchId);
    if (!batch) return null;
    if (batch.event_id !== data.eventId) throw new Error("Verzending hoort bij een ander evenement");
    return { subject: batch.subject, body: batch.body, rows: await deps.listStatuses(batch.id) };
  });
