import { createFileRoute } from "@tanstack/react-router";
import { receiveWhatsAppConnector } from "@/lib/whatsappConnector";

export const Route = createFileRoute("/api/public/_connector/whatsapp/webhook")({
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
        // Attachments: bounded, best-effort; failures stay in the inbox and never block receipt.
        const lovableKey = process.env["LOVABLE_API_KEY"];
        const waKey = process.env["WHATSAPP_API_KEY"];
        if (!lovableKey || !waKey) return;
        try {
          const claimed = await rpc("whatsapp_attachment_claim", { p_limit: 1 });
          if (claimed.error || !Array.isArray(claimed.data)) return;
          const { processAttachment } = await import("@/lib/whatsappMedia");
          for (const claim of claimed.data as import("@/lib/whatsappMedia").MediaClaim[]) {
            await processAttachment(claim, {
              fetch,
              headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": waKey },
              upload: async (path, bytes, mime) => {
                const { error } = await supabaseAdmin.storage.from("announcement-media")
                  .upload(path, bytes, { contentType: mime, upsert: false });
                if (error && !/exists|duplicate/i.test(error.message)) throw new Error("upload_failed");
              },
              complete: async (id, path, sha, size, mime) => {
                const r = await rpc("whatsapp_attachment_complete", { p_id: id, p_path: path, p_sha256: sha, p_size: size, p_mime: mime });
                if (r.error) throw new Error("complete_failed");
                try {
                  const { copyAttachmentToProjects } = await import("@/lib/announcementProjectDocs.server");
                  await copyAttachmentToProjects(supabaseAdmin, path);
                } catch {
                  console.error("[whatsapp-connector] project document copy skipped");
                }
              },
              fail: async (id, error, final) => {
                await rpc("whatsapp_attachment_fail", { p_id: id, p_error: error, p_final: final });
              },
            });
          }
        } catch {
          console.error("[whatsapp-connector] attachment processing deferred");
        }
      },
    ),
  } },
});