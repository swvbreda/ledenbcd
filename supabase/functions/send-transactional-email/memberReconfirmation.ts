import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { template } from '../_shared/transactional-email-templates/membership-reconfirmation.tsx'
import { reconfirmationLink, RECONFIRMATION_FROM, RECONFIRMATION_REPLY_TO, runReconfirmationSend, ReconfirmationSuppressedError } from '../_shared/memberReconfirmationPolicy.ts'

// This branch is deliberately isolated from caller-controlled templates/recipients.
// Only one existing campaign request is accepted; there is no list/bulk action.
export async function sendMemberReconfirmation(req: Request, body: Record<string, unknown>, url: string, serviceKey: string) {
  const requestId = body.requestId
  if (typeof requestId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestId)) throw new Error('Ongeldig verzoek')
  const db = createClient(url, serviceKey)
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  const claimId = crypto.randomUUID()
  let contact: Record<string, any> = {}
  const result = await runReconfirmationSend({
    authorize: async () => {
      const key = Deno.env.get('SUPABASE_ANON_KEY')
      const authorization = req.headers.get('authorization') ?? ''
      if (!key || !authorization.startsWith('Bearer ')) throw new Error('Geen toegang')
      const caller = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } })
      const { data: user, error } = await caller.auth.getUser()
      if (error || !user.user) throw new Error('Geen toegang')
      const role = await caller.rpc('has_role', { _user_id: user.user.id, _role: 'admin' })
      if (role.error || role.data !== true) throw new Error('Geen toegang')
      return user.user.id
    },
    claim: async actor => {
      const { data, error } = await db.rpc('member_reconfirmation_claim', { _id: requestId, _actor: actor, _hash: hash, _claim: claimId })
      if (error || !data) throw new Error('Verzending niet toegestaan of claim mislukt')
      contact = data
      return data
    },
    send: async () => {
      const gatewayKey = Deno.env.get('LOVABLE_API_KEY')
      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (!gatewayKey || !resendKey) throw new Error('Provider niet beschikbaar')
      // Recheck suppression immediately before preparing/sending, fail closed.
      const suppression = await db.from('suppressed_emails').select('id').ilike('email', contact.email).limit(1)
      if (suppression.error) throw new Error('Onderdrukking niet controleerbaar')
      if (suppression.data?.length) throw new ReconfirmationSuppressedError()
      let unsubscribe = await db.from('email_unsubscribe_tokens').select('token,used_at').eq('email', contact.email).maybeSingle()
      if (unsubscribe.error) throw new Error('Uitschrijfstatus niet controleerbaar')
      if (unsubscribe.data?.used_at) throw new ReconfirmationSuppressedError()
      if (!unsubscribe.data) {
        const inserted = await db.from('email_unsubscribe_tokens').upsert({ email: contact.email, token: crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '') }, { onConflict: 'email', ignoreDuplicates: true })
        if (inserted.error) throw new Error('Uitschrijflink opslaan mislukt')
        unsubscribe = await db.from('email_unsubscribe_tokens').select('token,used_at').eq('email', contact.email).maybeSingle()
      }
      if (unsubscribe.error || !unsubscribe.data) throw new Error('Uitschrijflink ontbreekt')
      if (unsubscribe.data.used_at) throw new ReconfirmationSuppressedError()
      const props = { contactName: contact.name, invoiceNumber: contact.invoice_number, shop: contact.shop, confirmationUrl: reconfirmationLink(token) }
      const html = await renderAsync(React.createElement(template.component, props))
      const text = await renderAsync(React.createElement(template.component, props), { plainText: true })
      const unsubscribeUrl = `${url}/functions/v1/handle-email-unsubscribe?token=${unsubscribe.data.token}`
      const response = await fetch('https://connector-gateway.lovable.dev/resend/emails', {
        method: 'POST', signal: AbortSignal.timeout(20_000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${gatewayKey}`, 'X-Connection-Api-Key': resendKey, 'Idempotency-Key': contact.idempotency_key },
        body: JSON.stringify({ from: RECONFIRMATION_FROM, reply_to: RECONFIRMATION_REPLY_TO, to: [contact.email], subject: template.subject,
          html: html + `<p style="font-family:Arial,sans-serif;font-size:12px">Je ontvangt deze e-mail van de Bond van Cannabis Detaillisten. <a href="${unsubscribeUrl}">Uitschrijven</a></p>`,
          text: `${text}\n\nUitschrijven: ${unsubscribeUrl}`,
          headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        }),
      })
      const data = await response.json().catch(() => ({}))
      return { ok: response.ok, status: response.status, id: data.id }
    },
    finish: async (status, id, http) => {
      const { error } = await db.rpc('member_reconfirmation_finish', { _id: requestId, _claim: claimId, _status: status, _provider_id: id, _http: http })
      if (error) throw new Error('Verzenduitkomst niet vastgelegd; niet opnieuw versturen')
    },
  })
  // Never return recipient data, confirmation tokens, URLs or provider payloads.
  return result
}