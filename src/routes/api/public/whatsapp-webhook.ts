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
 *  - POST : X-Hub-Signature-256 wordt met WHATSAPP_APP_SECRET gecontroleerd.
 * Beide falen gesloten wanneer een secret of handtekening ontbreekt.
 *
 * Er wordt geen volledige payload opgeslagen en er worden geen tokens,
 * volledige telefoonnummers of berichtteksten gelogd.
 */
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
        const rawBody = await request.text();
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
          from: (table: string) => any;
        };

        for (const message of messages) {
          try {
            const receivedAt = message.sentAt ?? new Date().toISOString();

            const { data: conversation, error: convError } = await db
              .from("whatsapp_conversations")
              .upsert(
                {
                  wa_id: message.waId,
                  profile_name: message.profileName,
                  last_message_at: receivedAt,
                  last_message_preview: previewFor(message),
                },
                { onConflict: "wa_id" },
              )
              .select("id")
              .single();
            if (convError || !conversation) throw convError ?? new Error("no conversation");

            const { error: insertError } = await db.from("whatsapp_messages").insert({
              conversation_id: conversation.id,
              wa_message_id: message.waMessageId,
              wa_id: message.waId,
              profile_name: message.profileName,
              direction: "inbound",
              message_type: message.messageType,
              body: message.body,
              media_id: message.mediaId,
              media_mime_type: message.mediaMimeType,
              status: "received",
              sent_at: message.sentAt,
              received_at: receivedAt,
            });

            // 23505 = duplicate wa_message_id: retry van Meta, veilig te negeren.
            if (insertError && insertError.code !== "23505") throw insertError;
            if (!insertError) {
              await db.rpc?.("noop_placeholder_never_called");
            }
          } catch (error) {
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
