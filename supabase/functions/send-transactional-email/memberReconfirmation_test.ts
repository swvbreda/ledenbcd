import { runReconfirmationSend, reconfirmationOutcome } from '../_shared/memberReconfirmationPolicy.ts'
Deno.test('reconfirmation sender never retries uncertain transport and surfaces storage failure', async () => {
  let sends = 0
  let recorded = ''
  const deps = { authorize: async () => 'admin', claim: async () => ({ claimed: true }), send: async () => { sends++; throw new Error('uncertain') }, finish: async (s: string) => { recorded = s } }
  const result = await runReconfirmationSend(deps)
  if (sends !== 1 || recorded !== 'unknown' || result.success) throw new Error('Uncertain outcome safety violated')
  let failed = false
  try { await runReconfirmationSend({ ...deps, send: async () => ({ ok: true, status: 200, id: 'accepted' }), finish: async () => { throw new Error('db failure') } }) } catch { failed = true }
  if (!failed) throw new Error('Storage failure reported as success')
})
Deno.test('reconfirmation requires accepted HTTP and provider id', () => {
  if (reconfirmationOutcome(true, 200, null) !== 'unknown') throw new Error('Missing provider proof')
  if (reconfirmationOutcome(false, 503, 'id') !== 'unknown') throw new Error('5xx retry unsafe')
  if (reconfirmationOutcome(true, 200, 'id') !== 'sent') throw new Error('Accepted result lost')
})