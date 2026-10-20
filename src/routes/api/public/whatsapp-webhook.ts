import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";
import {
  parseIncomingMessages,
  incomingMessageEnvelopes,
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
        const declaredLength = Number(
          request.headers.get("content-length") ?? "0",
        );
        if (
          Number.isFinite(declaredLength) &&
          declaredLength > MAX_BODY_BYTES
        ) {
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

        const { supabaseAdmin } =
          await import("@/integrations/supabase/client.server");

        for (const envelope of incomingMessageEnvelopes(payload)) {
          const message = messages.find(m => m.waMessageId === envelope.message.id && m.waId === envelope.message.from);
          if (!message) continue;
          const { error } = await supabaseAdmin.rpc("whatsapp_ingest_verified", {
            p_message: envelope.message as Json,
            p_recipient: envelope.recipient ?? "",
            p_parsed: { ...message },
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
