import { createFileRoute } from "@tanstack/react-router";
import {
  parseIncomingMessages,
  previewFor,
  verifyChallenge,
  verifySignature,
} from "@/lib/whatsappWebhook";

/**
 * Webhook voor de officiële WhatsApp Business Platform Cloud API.
 *
 * Meta kan geen Supabase-JWT meesturen, daarom staat deze route onder
 * /api/public/. De verificatie gebeurt hier zelf:
 *  - GET  : hub.verify_token wordt vergeleken met WHATSAPP_VERIFY_TOKEN.
 *  - POST : X-Hub-Signature-256 wordt op de ruwe body gecontroleerd met
 *           WHATSAPP_APP_SECRET, vóór het parsen van JSON.
 * Beide falen gesloten wanneer een secret of handtekening ontbreekt.
 *
 * Opslaan gebeurt via de service-role-only databasefunctie
 * whatsapp_ingest_message: atomair en idempotent per wa_message_id.
 * Er wordt geen ruwe payload bewaard en er worden geen tokens, volledige
 * telefoonnummers of berichtteksten gelogd.
 */

/** Meta-webhookberichten zijn klein; ruim bemeten bovengrens. */
const MAX_BODY_BYTES = 256 * 1024;

export const Route = createFileRoute("/api/public/whatsapp-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const result = verifyChallenge(
          url.searchParams,
          process.env["WHATSAPP_VERIFY_TOKEN"],
        );
        if (!result.ok) return new Response("Forbidden", { status: 403 });
        return new Response(result.challenge, {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        });
      },

      POST: async ({ request }) => {
        const declaredLength = Number(request.headers.get("content-length") ?? "0");
        if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
          return new Response("Payload too large", { status: 413 });
        }

        const rawBody = await request.text();
        if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
          return new Response("Payload too large", { status: 413 });
        }

        const valid = await verifySignature(
          rawBody,
          request.headers.get("x-hub-signature-256"),
          process.env["WHATSAPP_APP_SECRET"],
        );
        if (!valid) {
          console.warn("[whatsapp-webhook] signature check failed");
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        const messages = parseIncomingMessages(payload);
        if (messages.length === 0) return new Response("ok", { status: 200 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as unknown as {
          rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;
        };

        for (const message of messages) {
          const { error } = await db.rpc("whatsapp_ingest_message", {
            p_wa_id: message.waId,
            p_profile_name: message.profileName,
            p_wa_message_id: message.waMessageId,
            p_message_type: message.messageType,
            p_body: message.body,
            p_media_id: message.mediaId,
            p_media_mime_type: message.mediaMimeType,
            p_sent_at: message.sentAt,
            p_preview: previewFor(message),
          });

          if (error) {
            console.error("[whatsapp-webhook] kon bericht niet opslaan", {
              code: (error as { code?: string })?.code ?? "unknown",
            });
            return new Response("Storage error", { status: 500 });
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
