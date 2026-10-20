import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseBcdPhoneNumber } from "./bcdWhatsAppNumber";

/** Read-only: returns the public business number of the connected BCD WhatsApp number, or a blocker. */
export const getBcdWhatsAppNumber = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ display: string; digits: string } | { blocker: string }> => {
    const lovableKey = process.env["LOVABLE_API_KEY"];
    const waKey = process.env["WHATSAPP_API_KEY"];
    if (!lovableKey || !waKey) return { blocker: "WhatsApp-koppeling niet geconfigureerd" };
    try {
      const res = await fetch("https://connector-gateway.lovable.dev/whatsapp/phone_number?fields=id,display_phone_number", {
        headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": waKey },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { blocker: `Nummer niet op te halen (${res.status})` };
      const parsed = parseBcdPhoneNumber(await res.json());
      return parsed ?? { blocker: "Verbonden nummer is niet het vaste BCD-nummer" };
    } catch {
      return { blocker: "Nummer niet op te halen" };
    }
  });
