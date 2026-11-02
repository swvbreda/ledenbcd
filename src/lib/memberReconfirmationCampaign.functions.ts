import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { RECONFIRMATION_CAMPAIGN, RECONFIRMATION_MEMBERS, reconfirmationDisplayStatus } from '../../supabase/functions/_shared/memberReconfirmationPolicy';

export type ReconfirmationCampaignRow = { id: string; member_id: number; invoice_number: string; shop: string; name: string; email: string; status: string; blocked: boolean; sent_at: string | null; deadline: string; confirmed_at: string | null };
export const getMemberReconfirmationCampaign = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReconfirmationCampaignRow[]> => {
    const role = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (role.error || role.data !== true) throw new Error('Geen toegang');
    const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
    const { data, error } = await db.from('member_reconfirmation_requests')
      .select('id,member_id,invoice_number,sent_at,deadline,confirmed_at,revoked_at,activated_at,send_status,send_started_at,recipient_email,recipient_name')
      .eq('campaign', RECONFIRMATION_CAMPAIGN).in('member_id', [...RECONFIRMATION_MEMBERS]).order('member_id');
    if (error) throw new Error('Bevestigingsverzoeken laden mislukt');
    return Promise.all((data ?? []).map(async r => {
      const contact = await db.rpc('member_reconfirmation_recipient', { _member: r.member_id });
      const d = contact.data as { email?: string; name?: string; shop?: string } | null;
      const email = r.recipient_email || d?.email || '';
      const suppression = email ? await db.from('suppressed_emails').select('id').ilike('email', email).limit(1) : null;
      const blocked = Boolean(contact.error || suppression?.error || suppression?.data?.length || !r.activated_at || r.revoked_at || !email);
      return { id: r.id, member_id: r.member_id, invoice_number: r.invoice_number, shop: d?.shop || `Lid ${r.member_id}`, name: r.recipient_name || d?.name || '', email,
        status: reconfirmationDisplayStatus(r), blocked, sent_at: r.sent_at, deadline: r.deadline, confirmed_at: r.confirmed_at };
    }));
  });