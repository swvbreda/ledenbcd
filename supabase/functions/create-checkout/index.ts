import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const plan: "full" | "installment" = body.plan === "installment" ? "installment" : "full";
    const year: number = Number(body.year) || new Date().getFullYear();
    const installmentNumber: number = plan === "installment" ? (Number(body.installmentNumber) === 2 ? 2 : 1) : 1;
    const environment: StripeEnv = body.environment === "live" ? "live" : "sandbox";
    const returnUrl: string = String(body.returnUrl || "");
    if (!returnUrl.startsWith("http")) throw new Error("Invalid returnUrl");

    // Verify user is linked to a member
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await adminClient
      .from("member_profiles")
      .select("member_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile?.member_id) {
      return new Response(JSON.stringify({ error: "Geen lid gekoppeld aan dit account" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const memberId: number = profile.member_id;

    const priceLookupKey = plan === "full" ? "contributie_ineens" : "contributie_termijn";
    const installmentCount = plan === "full" ? 1 : 2;

    const stripe = createStripeClient(environment);

    const prices = await stripe.prices.list({ lookup_keys: [priceLookupKey] });
    if (!prices.data.length) throw new Error(`Price not found: ${priceLookupKey}`);
    const stripePrice = prices.data[0];

    // Resolve or create customer
    let customerId: string | undefined;
    if (userData.user.email) {
      const found = await stripe.customers.search({
        query: `metadata['userId']:'${userId}'`,
        limit: 1,
      }).catch(() => ({ data: [] as any[] }));
      if (found.data.length) customerId = found.data[0].id;
      else {
        const existing = await stripe.customers.list({ email: userData.user.email, limit: 1 });
        if (existing.data.length) {
          customerId = existing.data[0].id;
          await stripe.customers.update(customerId, { metadata: { ...existing.data[0].metadata, userId } });
        } else {
          const created = await stripe.customers.create({ email: userData.user.email, metadata: { userId } });
          customerId = created.id;
        }
      }
    }

    const productId = typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product.id;
    const product = await stripe.products.retrieve(productId);
    const description = `${product.name} ${year}${plan === "installment" ? ` (termijn ${installmentNumber}/2)` : ""}`;

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      ...(customerId && { customer: customerId }),
      payment_intent_data: { description },
      metadata: {
        userId,
        member_id: String(memberId),
        year: String(year),
        plan,
        installment_number: String(installmentNumber),
        installment_count: String(installmentCount),
      },
    });

    // Pre-register pending payment row (idempotent by stripe_session_id)
    const amount = plan === "full" ? 3000 : 1500;
    await adminClient.from("contribution_payments").insert({
      member_id: memberId,
      year,
      amount,
      installment_number: installmentNumber,
      installment_count: installmentCount,
      status: "pending",
      payment_method: "stripe",
      stripe_session_id: session.id,
      stripe_environment: environment,
      created_by: userId,
    });

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("create-checkout error:", e);
    return new Response(JSON.stringify({ error: e.message || "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});