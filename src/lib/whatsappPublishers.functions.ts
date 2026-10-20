import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizePublisherPhone } from "./whatsappPublishers";

export const saveWhatsAppPublisher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ phone: z.string().max(60), enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (role.error || role.data !== true) throw new Error("Alleen beheerders kunnen afzenders toestaan.");
    const phone = normalizePublisherPhone(data.phone);
    if (!phone) throw new Error("Vul een internationaal nummer in, bijvoorbeeld met +31.");
    const result = await context.supabase.rpc("whatsapp_set_publisher", { p_phone: phone, p_enabled: data.enabled });
    if (result.error) throw new Error("Afzender kon niet worden opgeslagen.");
  });