import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const getLocalSpokespeople = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { readLocalSpokespeople } = await import('./localSpokespeople.server');
    return readLocalSpokespeople();
  });