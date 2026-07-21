// Informer two-way sync: push contribution invoices, pull payment status and creditors.
// Uses the Informer REST API. Endpoints assume the public v1 spec; can be overridden
// via INFORMER_BASE_URL secret if Informer uses a different host for this account.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const INFORMER_TOKEN = Deno.env.get("INFORMER_API_TOKEN") ?? "";
const INFORMER_ADMIN = Deno.env.get("INFORMER_ADMINISTRATION_ID") ?? "";
const INFORMER_BASE = (Deno.env.get("INFORMER_BASE_URL") ?? "https://api.informer.eu/v1").replace(/\/$/, "");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type ActionResult = { action: string; success: boolean; items_processed: number; error_message?: string; details?: unknown };

function informerHeaders() {
  return {
    "Authorization": `Bearer ${INFORMER_TOKEN}`,
    "X-Administration-Id": INFORMER_ADMIN,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

async function informerFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${INFORMER_BASE}${path}`, {
    ...init,
    headers: { ...informerHeaders(), ...(init.headers || {}) },
  });
  return res;
}

async function logResult(supabase: any, r: ActionResult) {
  await supabase.from("informer_sync_log").insert({
    action: r.action,
    success: r.success,
    items_processed: r.items_processed,
    error_message: r.error_message ?? null,
    details: r.details ?? null,
  });
}

async function pushInvoices(supabase: any): Promise<ActionResult> {
  const action = "push_invoices";
  try {
    const { data: contribs, error } = await supabase
      .from("member_contributions")
      .select("id, member_id, year, amount, external_invoice_id, invoice_number")
      .is("external_invoice_id", null)
      .eq("paid", false)
      .limit(50);
    if (error) throw error;
    if (!contribs?.length) return { action, success: true, items_processed: 0 };

    const { data: membersData } = await supabase
      .from("members_data")
      .select("id, data")
      .in("id", contribs.map((c: any) => c.member_id));
    const memberById = new Map<number, any>((membersData ?? []).map((m: any) => [m.id, m.data]));

    let processed = 0;
    const errors: string[] = [];
    for (const c of contribs) {
      const m = memberById.get(c.member_id) ?? {};
      const payload = {
        debtor: {
          name: m.bedrijfsnaam || m.naam || `Lid #${c.member_id}`,
          email: m.email ?? null,
          kvk_number: m.kvk ?? null,
          address: m.adres ?? null,
          postcode: m.postcode ?? null,
          city: m.plaats ?? null,
        },
        invoice_date: new Date().toISOString().slice(0, 10),
        reference: `Contributie ${c.year} — lid #${c.member_id}`,
        lines: [{
          description: `BCD-contributie ${c.year}`,
          quantity: 1,
          unit_price: Number(c.amount ?? 3000),
          vat_rate: 0,
        }],
      };
      const res = await informerFetch("/sales_invoices", { method: "POST", body: JSON.stringify(payload) });
      if (!res.ok) {
        errors.push(`member #${c.member_id}: ${res.status} ${await res.text().catch(() => "")}`.slice(0, 300));
        continue;
      }
      const body = await res.json().catch(() => ({}));
      const externalId = String(body?.id ?? body?.invoice_id ?? body?.data?.id ?? "");
      const invoiceNumber = body?.invoice_number ?? body?.number ?? body?.data?.invoice_number ?? null;
      await supabase.from("member_contributions").update({
        external_invoice_id: externalId || null,
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString().slice(0, 10),
      }).eq("id", c.id);
      processed++;
    }
    return { action, success: errors.length === 0, items_processed: processed, error_message: errors.join(" | ") || undefined };
  } catch (e) {
    return { action, success: false, items_processed: 0, error_message: (e as Error).message };
  }
}

async function pullPayments(supabase: any): Promise<ActionResult> {
  const action = "pull_payments";
  try {
    const { data: state } = await supabase.from("informer_sync_state").select("*").eq("id", 1).single();
    const since = state?.last_payment_sync_at ?? new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const res = await informerFetch(`/sales_invoices?status=paid&updated_since=${encodeURIComponent(since)}`);
    if (!res.ok) throw new Error(`Informer ${res.status}: ${await res.text().catch(() => "")}`.slice(0, 300));
    const body = await res.json().catch(() => ({}));
    const invoices: any[] = Array.isArray(body) ? body : (body?.data ?? body?.invoices ?? []);

    let processed = 0;
    for (const inv of invoices) {
      const externalId = String(inv.id ?? inv.invoice_id ?? "");
      if (!externalId) continue;
      const paidDate = inv.paid_date ?? inv.payment_date ?? new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from("member_contributions")
        .update({ paid: true, paid_date: paidDate })
        .eq("external_invoice_id", externalId);
      if (!error) processed++;
    }
    await supabase.from("informer_sync_state").update({ last_payment_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", 1);
    return { action, success: true, items_processed: processed };
  } catch (e) {
    return { action, success: false, items_processed: 0, error_message: (e as Error).message };
  }
}

async function pullCreditors(supabase: any): Promise<ActionResult> {
  const action = "pull_creditors";
  try {
    const { data: state } = await supabase.from("informer_sync_state").select("*").eq("id", 1).single();
    const since = state?.last_creditor_sync_at ?? new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const res = await informerFetch(`/purchase_invoices?updated_since=${encodeURIComponent(since)}`);
    if (!res.ok) throw new Error(`Informer ${res.status}: ${await res.text().catch(() => "")}`.slice(0, 300));
    const body = await res.json().catch(() => ({}));
    const invoices: any[] = Array.isArray(body) ? body : (body?.data ?? body?.invoices ?? []);

    // Find or create a default "Informer-import" line item to attach expenses to
    const year = new Date().getFullYear();
    const { data: importLineItem } = await supabase.rpc("get_or_create_informer_line_item", { _year: year }).maybeSingle?.() ?? { data: null };
    let lineItemId: string | null = importLineItem?.id ?? null;
    if (!lineItemId) {
      // Fallback: find first existing line_item in current year
      const { data: anyLine } = await supabase
        .from("budget_line_items")
        .select("id, budget_categories!inner(year)")
        .eq("budget_categories.year", year)
        .limit(1)
        .maybeSingle();
      lineItemId = anyLine?.id ?? null;
    }
    if (!lineItemId) {
      return { action, success: true, items_processed: 0, error_message: "Geen budget-post gevonden om crediteur aan te koppelen — maak eerst een categorie + post aan." };
    }

    let processed = 0;
    for (const inv of invoices) {
      const externalId = String(inv.id ?? inv.invoice_id ?? "");
      if (!externalId) continue;
      const amount = Number(inv.total ?? inv.amount ?? 0);
      const creditor = inv.supplier?.name ?? inv.creditor_name ?? inv.creditor ?? "Onbekend";
      const expenseDate = inv.invoice_date ?? inv.date ?? new Date().toISOString().slice(0, 10);
      const description = inv.description ?? inv.reference ?? `Informer ${inv.invoice_number ?? externalId}`;

      // Upsert on external_id
      const { data: existing } = await supabase.from("budget_expenses").select("id").eq("external_id", externalId).maybeSingle();
      if (existing?.id) {
        await supabase.from("budget_expenses").update({
          amount, creditor_name: creditor, expense_date: expenseDate, description,
          paid: !!inv.paid, paid_date: inv.paid_date ?? null,
        }).eq("id", existing.id);
      } else {
        await supabase.from("budget_expenses").insert({
          line_item_id: lineItemId,
          amount,
          direction: "out",
          creditor_name: creditor,
          expense_date: expenseDate,
          description,
          source: "informer",
          external_id: externalId,
          invoice_reference: inv.invoice_number ?? null,
          paid: !!inv.paid,
          paid_date: inv.paid_date ?? null,
          created_by: "00000000-0000-0000-0000-000000000000",
        });
      }
      processed++;
    }
    await supabase.from("informer_sync_state").update({ last_creditor_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", 1);
    return { action, success: true, items_processed: processed };
  } catch (e) {
    return { action, success: false, items_processed: 0, error_message: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Require an authenticated admin user OR the internal webhook secret.
  // Called from InformerSyncTab.tsx (admin UI) and can also be triggered
  // server-side; anonymous callers are rejected.
  const INTERNAL_WEBHOOK_SECRET = Deno.env.get("INTERNAL_WEBHOOK_SECRET") ?? "";
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";
  const internalSecret = req.headers.get("x-internal-secret") ?? "";
  const isServiceRole = SERVICE_ROLE && authHeader === `Bearer ${SERVICE_ROLE}`;
  const isInternal = INTERNAL_WEBHOOK_SECRET && internalSecret === INTERNAL_WEBHOOK_SECRET;
  let authorized = isServiceRole || isInternal;
  if (!authorized) {
    if (!authHeader.startsWith("Bearer ") || !ANON_KEY) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    try {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userRes, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userRes?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userRes.user.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authorized = true;
    } catch (_e) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (!INFORMER_TOKEN || !INFORMER_ADMIN) {
    return new Response(JSON.stringify({ error: "Informer secrets niet geconfigureerd" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "all";

  const results: ActionResult[] = [];
  try {
    if (action === "push_invoices" || action === "all") results.push(await pushInvoices(supabase));
    if (action === "pull_payments" || action === "all") results.push(await pullPayments(supabase));
    if (action === "pull_creditors" || action === "all") results.push(await pullCreditors(supabase));

    for (const r of results) await logResult(supabase, r);

    const allOk = results.every(r => r.success);
    return new Response(JSON.stringify({ success: allOk, results }), {
      status: allOk ? 200 : 207,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    await logResult(supabase, { action, success: false, items_processed: 0, error_message: (e as Error).message });
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});