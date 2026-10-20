import { createFileRoute } from "@tanstack/react-router";
import { receiveWhatsAppConnector } from "@/lib/whatsappConnector";

export const Route = createFileRoute("/api/public/whatsapp/webhook")({
  server: { handlers: {
    POST: async ({ request }) => receiveWhatsAppConnector(
      request, process.env["WHATSAPP_API_KEY"], async (receipt) => {
        // Only reached after connector signature and payload verification.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Additive RPCs are not yet in the managed generated types.
        const rpc = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
          name: string, args?: Record<string, unknown>,
        ) => PromiseLike<{ data?: unknown; error: { code?: string } | null }>;
        const saved = await rpc("whatsapp_connector_receive", {
          p_delivery_id: receipt.deliveryId, p_event: receipt.event,
          p_payload: receipt.payload, p_messages: receipt.messages,
        });
        if (saved.error) throw new Error("Receipt failed");
        const processed = await rpc("whatsapp_connector_process", {
          p_delivery_id: receipt.deliveryId,
        });
        if (processed.error || processed.data !== true) throw new Error("Processing failed");
        // Bounded fair recovery of earlier unfinished work; no sends or imports.
        const recovered = await rpc("whatsapp_connector_recover");
        if (recovered.error) throw new Error("Recovery failed");
      },
    ),
  } },
});