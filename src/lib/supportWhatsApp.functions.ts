import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runSupportWhatsAppReply, type SupportRpc } from "./supportWhatsApp";

const input = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  clientKey: z.string().uuid(),
});

/** Admin-only, explicit click: reserve once (24h window checked in DB), send once, record outcome. */
export const sendSupportWhatsAppReply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }) => {
    const rpc = context.supabase.rpc.bind(context.supabase) as unknown as SupportRpc;
    return runSupportWhatsAppReply(data, rpc, {
      lovableKey: process.env["LOVABLE_API_KEY"], waKey: process.env["WHATSAPP_API_KEY"],
    }, fetch);
  });
