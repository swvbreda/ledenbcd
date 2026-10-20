import { verifyWebhookRequest, WebhookError } from "@lovable.dev/webhooks-js";
import { z } from "zod";
import { parseIncomingMessages } from "./whatsappWebhook";

const messageSchema = z.object({
  id: z.string().min(1).max(512),
  from: z.string().regex(/^\d{5,20}$/),
  type: z.string().min(1).max(40),
  timestamp: z.string().regex(/^\d{1,11}$/).optional(),
}).passthrough();
const envelope = z.object({
  entry: z.array(z.object({
    changes: z.array(z.object({
      value: z.object({
        messages: z.array(messageSchema).max(100).optional(),
        contacts: z.array(z.object({
          wa_id: z.string().optional(),
          profile: z.object({ name: z.string().optional() }).optional(),
        }).passthrough()).max(100).optional(),
        statuses: z.array(z.object({
          id: z.string().min(1).max(512),
          status: z.enum(["sent", "delivered", "read", "failed"]),
          timestamp: z.string().regex(/^\d{1,11}$/),
        }).passthrough()).max(100).optional(),
      }).passthrough(),
    }).passthrough()).length(1),
  }).passthrough()).length(1),
}).passthrough();

export interface ConnectorReceipt {
  deliveryId: string;
  event: string;
  payload: Record<string, unknown>;
  messages: ReturnType<typeof parseIncomingMessages>;
}

/** The store must durably insert before processing and schedule unmatched statuses. */
export async function receiveWhatsAppConnector(
  request: Request,
  secret: string | undefined,
  store: (receipt: ConnectorReceipt) => Promise<void>,
): Promise<Response> {
  if (!secret) return new Response("Receiver not configured", { status: 503 });
  let payload: unknown;
  try {
    ({ payload } = await verifyWebhookRequest({
      req: request, secret, maxBodyBytes: 4 * 1024 * 1024,
    }));
  } catch (error) {
    const code = error instanceof WebhookError ? error.code : "invalid_payload";
    const status = code === "body_too_large" ? 413
      : code === "invalid_json" || code === "invalid_payload" ? 400 : 401;
    return new Response("Invalid webhook", { status });
  }
  const deliveryId = request.headers.get("x-lovable-delivery")?.trim();
  const event = request.headers.get("x-lovable-event")?.trim();
  const parsed = envelope.safeParse(payload);
  if (!deliveryId || deliveryId.length > 512 || !event?.startsWith("whatsapp.")
    || event.length > 120 || !parsed.success) {
    return new Response("Invalid payload or delivery headers", { status: 400 });
  }
  const value = parsed.data.entry[0]?.changes[0]?.value;
  if ((event === "whatsapp.message" && !value?.messages?.length)
    || (event === "whatsapp.status" && !value?.statuses?.length)) {
    return new Response("Invalid event payload", { status: 400 });
  }
  try {
    await store({ deliveryId, event, payload: parsed.data,
      messages: event === "whatsapp.message" ? parseIncomingMessages(parsed.data) : [] });
    return new Response("ok", { status: 200 });
  } catch {
    // Never log message text, phone numbers, credentials, or raw payloads.
    console.error("[whatsapp-connector] durable processing failed");
    return new Response("Storage or processing error", { status: 503 });
  }
}