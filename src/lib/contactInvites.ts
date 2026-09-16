import { supabase } from "@/integrations/supabase/client";
import type { Contact, Member } from "@/data/types";

const EMAIL_RE = /^[^\s@"'<>,;:]+@[^\s@"'<>,;:]+\.[^\s@"'<>,;:]{2,}$/;

export const normalizeEmail = (raw: unknown): string =>
  (raw ?? "").toString().trim().toLowerCase();

const isValid = (email: string) => !!email && EMAIL_RE.test(email);

function contactEmails(contacten: Contact[] | undefined | null): Set<string> {
  const out = new Set<string>();
  for (const c of contacten ?? []) {
    const e = normalizeEmail(c?.email);
    if (isValid(e)) out.add(e);
  }
  return out;
}

/**
 * Bepaalt welke contactpersoon-adressen nieuw zijn toegevoegd.
 * Adressen die al elders bij het lid bekend waren (email, email2, factuurEmail)
 * of die al in de oude contactenlijst stonden, tellen niet mee.
 */
export function newContactEmails(
  previous: Partial<Member> | null | undefined,
  next: Partial<Member> | null | undefined,
): string[] {
  const known = contactEmails(previous?.contacten as Contact[] | undefined);
  for (const raw of [previous?.email, previous?.email2, previous?.factuurEmail]) {
    const e = normalizeEmail(raw);
    if (isValid(e)) known.add(e);
  }
  const out: string[] = [];
  for (const e of contactEmails(next?.contacten as Contact[] | undefined)) {
    if (!known.has(e) && !out.includes(e)) out.push(e);
  }
  return out;
}

const INVITE_TEMPLATES = ["member-welcome-steps", "member-welcome", "login-reminder"];

export interface InviteResult {
  email: string;
  status: "sent" | "skipped" | "error";
  reason?: string;
}

/**
 * Nodigt nieuwe contactpersonen uit: adres toestaan, op de mailinglijst zetten
 * en de welkomst-/inlogmail sturen. Faalt zacht: fouten blokkeren het opslaan niet.
 */
export async function sendContactInvites(
  memberId: number,
  member: Partial<Member> & { contacten?: Contact[] },
  emails: string[],
  memberType: "member" | "lead" = "member",
): Promise<InviteResult[]> {
  const results: InviteResult[] = [];
  if (emails.length === 0) return results;

  const tplKey = memberType === "member" ? "member_welcome" : "lead_welcome";
  const { data: tpl } = await supabase
    .from("email_templates")
    .select("subject, body")
    .eq("key", tplKey)
    .maybeSingle();

  for (const email of emails) {
    try {
      const { data: logRows } = await supabase
        .from("email_send_log")
        .select("id")
        .ilike("recipient_email", email)
        .in("template_name", INVITE_TEMPLATES)
        .limit(1);
      if (logRows && logRows.length > 0) {
        results.push({ email, status: "skipped", reason: "al eerder uitgenodigd" });
        continue;
      }

      const { error: allowErr } = await supabase
        .from("member_allowed_emails")
        .insert({ member_id: memberId, email });
      if (allowErr && !String(allowErr.message || "").toLowerCase().includes("duplicate")) {
        console.error("Allowed email insert failed", allowErr);
      }

      const { error: prefErr } = await supabase
        .from("member_mailing_preferences")
        .insert({ member_id: memberId, email });
      if (prefErr && !String(prefErr.message || "").toLowerCase().includes("duplicate")) {
        console.error("Mailing preference insert failed", prefErr);
      }

      if (!tpl) {
        results.push({ email, status: "error", reason: "geen e-mailsjabloon gevonden" });
        continue;
      }

      const contactNaam =
        (member.contacten ?? []).find((c) => normalizeEmail(c?.email) === email)?.naam?.trim() ||
        "lid";
      const fill = (s: string) =>
        (s || "")
          .split("{{contactpersoon}}").join(contactNaam)
          .split("{{coffeeshop}}").join((member.naam || "").toString().trim())
          .split("{{plaats}}").join((member.plaats || "").toString().trim());

      const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "member-welcome-steps",
          recipientEmail: email,
          idempotencyKey: `contact-invite-${memberId}-${email}`,
          templateData: {
            subject: fill(tpl.subject),
            body: fill(tpl.body),
            showSteps: memberType === "member",
          },
        },
      });
      if (mailErr) throw mailErr;
      results.push({ email, status: "sent" });
    } catch (err: any) {
      console.error("Uitnodiging contactpersoon mislukt", email, err);
      results.push({ email, status: "error", reason: err?.message || "onbekende fout" });
    }
  }

  return results;
}
