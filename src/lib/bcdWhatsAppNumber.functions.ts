import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BCD_SUPPORT_NUMBER } from "./bcdWhatsAppNumber";

/**
 * Read-only: returns the fixed, proven BCD business number for the link-code card.
 * No external call needed; the number is pinned to BCD_SUPPORT_PHONE_NUMBER_ID.
 */
export const getBcdWhatsAppNumber = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ display: string; digits: string } | { blocker: string }> => {
    return { display: BCD_SUPPORT_NUMBER.display, digits: BCD_SUPPORT_NUMBER.digits };
  });
