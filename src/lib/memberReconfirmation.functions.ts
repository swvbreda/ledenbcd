import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

const input = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), confirm: z.boolean().default(false) });
// A 256-bit scoped capability permits only inspection/confirmation of this request.
// No account access, contact details, invoice data or member lists are returned.
export const memberReconfirmation = createServerFn({ method: 'POST' })
  .inputValidator((value: unknown) => input.parse(value))
  .handler(async ({ data }) => {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data.token));
    const hash = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: result, error } = await (supabaseAdmin as any).rpc('member_reconfirmation_answer', { _hash: hash, _confirm: data.confirm });
    if (error) throw new Error('Opslaan is niet gelukt. Probeer opnieuw of mail info@coffeeshopbond.nl.');
    return result as { valid: boolean; confirmed?: boolean; deadline?: string };
  });
