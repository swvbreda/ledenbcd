import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function markSessionPaid(sessionId: string, paymentIntentId: string | null) {
  await supabase
    .from("contribution_payments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq("stripe_session_id", sessionId);
}

async function markSessionFailed(sessionId: string) {
  await supabase
    .from("contribution_payments")
    .update({ status: "failed" })
    .eq("stripe_session_id", sessionId);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  const env: StripeEnv = rawEnv;

  try {
    const event = await verifyWebhook(req, env);
    const obj = event.data.object as any;

    switch (event.type) {
      case "checkout.session.completed":
      case "transaction.completed": {
        const sessionId: string | undefined = obj.id || obj.checkout_session;
        const paymentIntentId: string | null = obj.payment_intent ?? null;
        if (sessionId) await markSessionPaid(sessionId, paymentIntentId);
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        if (obj.id) await markSessionPaid(obj.id, obj.payment_intent ?? null);
        break;
      }
      case "checkout.session.expired":
      case "transaction.payment_failed":
      case "checkout.session.async_payment_failed": {
        const sessionId: string | undefined = obj.id || obj.checkout_session;
        if (sessionId) await markSessionFailed(sessionId);
        break;
      }
      default:
        console.log("Unhandled event:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("Webhook error:", e?.message || e);
    return new Response("Webhook error", { status: 400 });
  }
});