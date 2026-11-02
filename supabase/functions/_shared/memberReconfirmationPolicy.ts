export const RECONFIRMATION_CAMPAIGN = 'contributie-2026-11'
export const RECONFIRMATION_MEMBERS = [10, 25, 34, 75, 78, 79, 91, 99, 107, 110, 114] as const
export const RECONFIRMATION_REPLY_TO = 'info@coffeeshopbond.nl'
export const RECONFIRMATION_FROM = 'Bond van Cannabis Detaillisten <noreply@leden.coffeeshopbond.nl>'
export const RECONFIRMATION_SUBJECT = 'Willen jullie aangesloten blijven bij de BCD?'
export const RECONFIRMATION_BUTTON = 'Ja, wij willen aangesloten blijven'
export function reconfirmationParagraphs(contactName: string, invoiceNumber: string, shop: string): string[] {
  return [
    `Beste ${contactName},`,
    `We houden ons ledenbestand graag actueel. Volgens onze administratie staat contributiefactuur ${invoiceNumber} van 15 januari 2026 voor ${shop} nog open. Misschien is deze aan jullie aandacht ontsnapt, of is er inmiddels iets veranderd binnen het bedrijf.`,
    'We blijven jullie graag betrekken bij de BCD. Willen jullie aangesloten blijven? Laat het ons dan binnen 30 dagen weten via onderstaande knop:',
    'Op de pagina kun je jullie keuze bevestigen; inloggen is niet nodig.',
    'Als we binnen die termijn geen bevestiging of reactie ontvangen, halen we jullie uit de verzendlijsten voor ledencommunicatie, waaronder nieuwsbrieven en uitnodigingen.',
    'Is de factuur inmiddels betaald, klopt er iets niet of is er een nieuwe contactpersoon? Laat het ons gerust weten door op deze mail te reageren. Ook als jullie willen stoppen of eerst even willen overleggen, horen we dat graag.',
    'De bevestiging verandert niets aan de openstaande factuur; eventuele vragen daarover pakken we graag samen op.',
    'Hartelijke groet,\nSecretariaat,\nBond van Cannabis Detaillisten,\ninfo@coffeeshopbond.nl.',
  ]
}
export function reconfirmationLink(token: string): string {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Ongeldige bevestigingscode')
  return `https://leden.coffeeshopbond.nl/lidmaatschap-bevestigen#token=${token}`
}
export function reconfirmationOutcome(ok: boolean, status: number, providerId: unknown): 'sent' | 'failed' | 'unknown' {
  if (ok && typeof providerId === 'string' && providerId.trim()) return 'sent'
  // Even an HTTP 2xx without an ID does not prove acceptance. Never retry it.
  return !ok && status >= 400 && status < 500 && status !== 408 ? 'failed' : 'unknown'
}
export function reconfirmationDisplayStatus(row: { send_status: string; send_started_at?: string | null; confirmed_at?: string | null }, now = Date.now()): string {
  if (row.confirmed_at) return 'confirmed'
  if (row.send_status === 'sending' && row.send_started_at && now - Date.parse(row.send_started_at) > 120_000) return 'unknown'
  return row.send_status
}

export interface ReconfirmationSendDeps {
  authorize(): Promise<string>
  claim(actor: string): Promise<{ claimed: boolean; status?: string }>
  send(): Promise<{ ok: boolean; status: number; id?: unknown }>
  finish(status: 'sent' | 'failed' | 'unknown' | 'suppressed', id: string | null, http: number | null): Promise<void>
}
export async function runReconfirmationSend(deps: ReconfirmationSendDeps) {
  const actor = await deps.authorize()
  const claim = await deps.claim(actor)
  if (!claim.claimed) return { success: false, status: claim.status ?? 'unknown' }
  let outcome: 'sent' | 'failed' | 'unknown' | 'suppressed' = 'unknown'
  let id: string | null = null
  let http: number | null = null
  try {
    const response = await deps.send()
    http = response.status
    id = typeof response.id === 'string' ? response.id : null
    outcome = reconfirmationOutcome(response.ok, response.status, response.id)
  } catch (error) {
    if (error instanceof ReconfirmationSuppressedError) outcome = 'suppressed'
    // No retry after any exception: a network failure can follow acceptance.
  }
  // Finish errors must escape; don't report a persisted success if storage failed.
  await deps.finish(outcome, id, http)
  return { success: outcome === 'sent', status: outcome }
}
export class ReconfirmationSuppressedError extends Error {}