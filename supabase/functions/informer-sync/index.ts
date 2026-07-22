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
const INFORMER_BASE = (Deno.env.get("INFORMER_BASE_URL") ?? "https://api.informer.eu/v2").replace(/\/$/, "");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type ApiCall = {
  ts: string;
  method: string;
  url: string;
  request_body?: unknown;
  status: number;
  ok: boolean;
  duration_ms: number;
  request_id: string | null;
  response_headers: Record<string, string>;
  response_body: unknown;
  error?: string;
  auth_mode?: string;
};

type ActionResult = {
  action: string;
  success: boolean;
  items_processed: number;
  error_message?: string;
  details?: unknown;
  api_calls?: ApiCall[];
};

function informerHeaders(swapped = false) {
  const apiKey = swapped ? INFORMER_ADMIN : INFORMER_TOKEN;
  const securityCode = swapped ? INFORMER_TOKEN : INFORMER_ADMIN;
  return {
    // Informer v1 expects these exact documented header names.
    // The previous ApiKey/SecurityCode casing was accepted inconsistently and
    // produced misleading 200 responses with an error body.
    "Apikey": apiKey,
    "Securitycode": securityCode,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

function hasInformerError(body: unknown): string | null {
  const value = body as any;
  if (!value || typeof value !== "object") return null;
  const err = value.error ?? value.errors;
  if (Array.isArray(err) && err.length) return err.map(String).join("; ");
  if (typeof err === "string" && err.trim()) return err;
  return null;
}

function looksLikeInformerRecord(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return [
    "relation_number", "company_name", "relation_id", "number", "date",
    "total_price_incl_tax", "total_price_excl_tax", "email", "email_invoice",
  ].some((key) => key in obj);
}

function normalizeInformerContainer(value: unknown): any[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeInformerContainer);
  if (typeof value !== "object") return [];
  if (looksLikeInformerRecord(value)) return [value];

  const obj = value as Record<string, unknown>;
  return Object.entries(obj).flatMap(([key, nested]) => {
    if (!nested || typeof nested !== "object") return [];
    if (looksLikeInformerRecord(nested)) {
      const record = nested as Record<string, unknown>;
      return [{ id: record.id ?? key, ...record }];
    }
    return normalizeInformerContainer(nested);
  });
}

function normalizeInformerList(body: unknown, keys: string[]): any[] {
  if (!body) return [];
  if (Array.isArray(body)) return body.flatMap((item) => normalizeInformerList(item, keys));
  if (typeof body !== "object") return [];
  const obj = body as Record<string, unknown>;
  for (const key of keys) {
    if (obj[key]) return normalizeInformerContainer(obj[key]);
  }
  return normalizeInformerContainer(obj);
}

function toAmount(value: unknown): number {
  if (typeof value === "number") return value;
  const normalized = String(value ?? "0")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstInformerItem(body: unknown, keys: string[]): any | null {
  return normalizeInformerList(body, keys)[0] ?? null;
}

async function fetchAllInformerPages(path: string, keys: string[], sink: ApiCall[], records = 100): Promise<any[]> {
  const all: any[] = [];
  for (let page = 0; page < 50; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const call = await informerCall(`${path}${separator}records=${records}&page=${page}`, {}, sink);
    if (call.error) throw new Error(`Netwerkfout: ${call.error}`);
    if (!call.ok) throw new Error(`Informer ${call.status} (req_id=${call.request_id ?? "-"})`);
    const apiError = hasInformerError(call.response_body);
    if (apiError) throw new Error(`Informer fout: ${apiError}`);
    const batch = normalizeInformerList(call.response_body, keys);
    all.push(...batch);
    if (batch.length < records) break;
  }
  return all;
}

// Wraps every Informer API call and returns a structured record with status,
// response body, correlation/request-id and timings. Callers use `call.response_body`
// (already parsed as JSON when possible) instead of re-reading the response.
async function informerCall(
  path: string,
  init: RequestInit = {},
  sink?: ApiCall[],
  swappedAuth = false,
): Promise<ApiCall> {
  const method = (init.method ?? "GET").toUpperCase();
  const url = `${INFORMER_BASE}${path}`;
  const started = performance.now();
  const ts = new Date().toISOString();
  let requestBodyParsed: unknown = undefined;
  if (typeof init.body === "string") {
    try { requestBodyParsed = JSON.parse(init.body); } catch { requestBodyParsed = init.body; }
  }
  let status = 0;
  let ok = false;
  let request_id: string | null = null;
  const response_headers: Record<string, string> = {};
  let response_body: unknown = null;
  let error: string | undefined;
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...informerHeaders(swappedAuth), ...(init.headers || {}) },
    });
    status = res.status;
    ok = res.ok;
    res.headers.forEach((v, k) => { response_headers[k] = v; });
    request_id =
      res.headers.get("x-request-id") ??
      res.headers.get("request-id") ??
      res.headers.get("x-correlation-id") ??
      res.headers.get("cf-ray") ??
      null;
    const raw = await res.text().catch(() => "");
    try { response_body = raw ? JSON.parse(raw) : null; }
    catch { response_body = raw.slice(0, 2000); }
  } catch (e) {
    error = (e as Error).message;
  }
  const call: ApiCall = {
    ts,
    method,
    url,
    request_body: requestBodyParsed,
    status,
    ok,
    duration_ms: Math.round(performance.now() - started),
    request_id,
    response_headers,
    response_body,
    error,
    auth_mode: swappedAuth ? "swapped_secrets" : "configured_secrets",
  };
  const apiError = hasInformerError(call.response_body);
  if (!swappedAuth && apiError && /security code|api key/i.test(apiError)) {
    const retry = await informerCall(path, init, undefined, true);
    sink?.push(retry);
    return retry;
  }
  sink?.push(call);
  return call;
}

async function logResult(supabase: any, r: ActionResult) {
  await supabase.from("informer_sync_log").insert({
    action: r.action,
    success: r.success,
    items_processed: r.items_processed,
    error_message: r.error_message ?? null,
    details: r.details ?? null,
    api_calls: r.api_calls ?? null,
  });
}

// Fetch-and-merge: overschrijf nooit de volledige data-JSON van een lid.
function mergeMemberDataFromDebtor(existing: any, debtor: any): any {
  const merged = { ...(existing ?? {}) };
  const set = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    const s = typeof value === "string" ? value.trim() : value;
    if (s === "" ) return;
    merged[key] = s;
  };
  set("bedrijfsnaam", debtor.name ?? debtor.company_name ?? debtor.debtor_name);
  set("email", debtor.email);
  set("telefoon", debtor.phone ?? debtor.telephone);
  set("kvk", debtor.kvk_number ?? debtor.chamber_of_commerce ?? debtor.coc_number);
  set("adres", debtor.address ?? debtor.street);
  set("postcode", debtor.postcode ?? debtor.postal_code ?? debtor.zip);
  set("plaats", debtor.city);
  merged.factuurBedrijfsnaam = merged.factuurBedrijfsnaam || merged.bedrijfsnaam;
  merged.factuurEmail = merged.factuurEmail || merged.email;
  merged.factuurKvk = merged.factuurKvk || merged.kvk;
  merged.factuurAdres = merged.factuurAdres || merged.adres;
  merged.factuurPostcode = merged.factuurPostcode || merged.postcode;
  merged.factuurPlaats = merged.factuurPlaats || merged.plaats;
  merged.factuurTelefoon = merged.factuurTelefoon || merged.telefoon;
  return merged;
}

async function pullDebtors(supabase: any): Promise<ActionResult> {
  const action = "pull_debtors";
  const api_calls: ApiCall[] = [];
  try {
    const { data: mapRows, error } = await supabase
      .from("informer_debtor_map")
      .select("member_id, informer_debtor_id");
    if (error) throw error;
    if (!mapRows?.length) {
      return { action, success: true, items_processed: 0, api_calls,
        error_message: "Geen debiteur-koppelingen — koppel eerst leden aan Informer-debiteuren." };
    }

    let processed = 0;
    const errors: string[] = [];
    for (const row of mapRows) {
      const call = await informerCall(`/relation/${encodeURIComponent(row.informer_debtor_id)}/`, {}, api_calls);
      (call as any).context = { member_id: row.member_id };
      if (call.error) { errors.push(`lid #${row.member_id}: netwerkfout ${call.error}`); continue; }
      if (!call.ok)  { errors.push(`lid #${row.member_id}: ${call.status} req_id=${call.request_id ?? "-"}`); continue; }
      const apiError = hasInformerError(call.response_body);
      if (apiError) { errors.push(`lid #${row.member_id}: Informer fout: ${apiError}`); continue; }
      const body: any = call.response_body ?? {};
      const debtor = firstInformerItem(body, ["relation", "relations", "data"]);
      if (!debtor || typeof debtor !== "object") { errors.push(`lid #${row.member_id}: lege debiteur-body`); continue; }
      // Debiteur moet minimaal een identificatie of naam bevatten om als geldig te tellen.
      if (!(debtor as any).id && !(debtor as any).relation_number && !(debtor as any).name && !(debtor as any).company_name) {
        errors.push(`lid #${row.member_id}: onverwachte debiteur-body (geen id/naam)`);
        continue;
      }

      const { data: existing } = await supabase.from("members_data").select("data").eq("id", row.member_id).maybeSingle();
      if (!existing) { errors.push(`lid #${row.member_id}: niet meer aanwezig`); continue; }
      const merged = mergeMemberDataFromDebtor(existing.data, debtor);
      const { error: upErr } = await supabase.from("members_data").update({ data: merged }).eq("id", row.member_id);
      if (upErr) { errors.push(`lid #${row.member_id}: ${upErr.message}`); continue; }
      processed++;
    }
    await supabase.from("informer_sync_state").update({
      last_debtor_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    return { action, success: errors.length === 0, items_processed: processed,
      error_message: errors.join(" | ") || undefined, api_calls };
  } catch (e) {
    return { action, success: false, items_processed: 0, error_message: (e as Error).message, api_calls };
  }
}

function detectYear(inv: any): number | null {
  const ref: string = String(inv.reference ?? inv.description ?? "");
  const m = ref.match(/(20\d{2})/);
  if (m) return Number(m[1]);
  const d = inv.invoice_date ?? inv.date;
  if (d) { const y = Number(String(d).slice(0, 4)); if (y >= 2000 && y < 3000) return y; }
  return null;
}

async function pullInvoices(supabase: any): Promise<ActionResult> {
  const action = "pull_invoices";
  const api_calls: ApiCall[] = [];
  try {
    const { data: mapRows, error } = await supabase
      .from("informer_debtor_map")
      .select("member_id, informer_debtor_id");
    if (error) throw error;
    if (!mapRows?.length) {
      return { action, success: true, items_processed: 0, api_calls,
        error_message: "Geen debiteur-koppelingen — koppel eerst leden aan Informer-debiteuren." };
    }

    const mappedRelationIds = new Set(mapRows.map((row: any) => String(row.informer_debtor_id)));
    const relationToMember = new Map(mapRows.map((row: any) => [String(row.informer_debtor_id), row.member_id]));
    const invoices = await fetchAllInformerPages("/invoices/sales/", ["sales", "invoices", "data"], api_calls);

    let processed = 0;
    const errors: string[] = [];
    for (const inv of invoices) {
        const relationId = String(inv.relation_id ?? inv.debtor_id ?? inv.customer_id ?? "");
        if (relationId && !mappedRelationIds.has(relationId)) continue;
        const memberId = relationToMember.get(relationId);
        if (!memberId) continue;
        const externalId = String(inv.id ?? inv.invoice_id ?? "");
        const year = detectYear(inv);
        if (!externalId || !year) continue;
        const amount = toAmount(inv.total_price_incl_tax ?? inv.total ?? inv.amount ?? 0);
        const invoiceNumber = inv.invoice_number ?? inv.number ?? null;
        const invoiceDate = inv.invoice_date ?? inv.date ?? null;
        const paidAmount = toAmount(inv.paid ?? 0);
        const isPaid = paidAmount >= amount || String(inv.status ?? "").toLowerCase() === "paid";
        const paidDate = inv.paid_date ?? inv.payment_date ?? null;

        // Try match by external_invoice_id first, otherwise by (member_id, year)
        const { data: existing } = await supabase
          .from("member_contributions")
          .select("id")
          .or(`external_invoice_id.eq.${externalId},and(member_id.eq.${memberId},year.eq.${year})`)
          .maybeSingle();
        const patch: any = {
          external_invoice_id: externalId,
          amount,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          paid: isPaid,
          paid_date: isPaid ? (paidDate ?? new Date().toISOString().slice(0, 10)) : null,
        };
        if (existing?.id) {
          await supabase.from("member_contributions").update(patch).eq("id", existing.id);
        } else {
          await supabase.from("member_contributions").insert({
            member_id: memberId, year, ...patch,
          });
        }
        processed++;
    }
    await supabase.from("informer_sync_state").update({
      last_payment_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", 1);
    return { action, success: errors.length === 0, items_processed: processed,
      error_message: errors.join(" | ") || undefined, api_calls };
  } catch (e) {
    return { action, success: false, items_processed: 0, error_message: (e as Error).message, api_calls };
  }
}

async function pullCreditors(supabase: any): Promise<ActionResult> {
  const action = "pull_creditors";
  const api_calls: ApiCall[] = [];
  try {
    const { data: state } = await supabase.from("informer_sync_state").select("*").eq("id", 1).single();
    const since = state?.last_creditor_sync_at ?? new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const lastEdit = String(since).slice(0, 10);
    const call = await informerCall(
      `/invoices/purchase/?last_edit=${encodeURIComponent(lastEdit)}`,
      {},
      api_calls,
    );
    if (call.error) throw new Error(`Netwerkfout: ${call.error}`);
    if (!call.ok) throw new Error(`Informer ${call.status} (req_id=${call.request_id ?? "-"})`);
    const apiError = hasInformerError(call.response_body);
    if (apiError) throw new Error(`Informer fout: ${apiError}`);
    const invoices = normalizeInformerList(call.response_body, ["purchase", "invoices", "data"]);

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
      return { action, success: true, items_processed: 0, error_message: "Geen budget-post gevonden om crediteur aan te koppelen — maak eerst een categorie + post aan.", api_calls };
    }

    let processed = 0;
    for (const inv of invoices) {
      const externalId = String(inv.id ?? inv.invoice_id ?? "");
      if (!externalId) continue;
      const amount = toAmount(inv.total_price_incl_tax ?? inv.total ?? inv.amount ?? 0);
      const creditor = inv.supplier?.name ?? inv.creditor_name ?? inv.creditor ?? "Onbekend";
      const expenseDate = inv.invoice_date ?? inv.date ?? new Date().toISOString().slice(0, 10);
      const description = inv.description ?? inv.reference ?? `Informer ${inv.invoice_number ?? externalId}`;

      // Upsert on external_id
      const { data: existing } = await supabase.from("budget_expenses").select("id").eq("external_id", externalId).maybeSingle();
      if (existing?.id) {
        await supabase.from("budget_expenses").update({
          amount, creditor_name: creditor, expense_date: expenseDate, description,
          paid: toAmount(inv.paid ?? 0) >= amount, paid_date: inv.payment_date ?? inv.paid_date ?? null,
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
          paid: toAmount(inv.paid ?? 0) >= amount,
          paid_date: inv.payment_date ?? inv.paid_date ?? null,
          created_by: "00000000-0000-0000-0000-000000000000",
        });
      }
      processed++;
    }
    await supabase.from("informer_sync_state").update({ last_creditor_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", 1);
    return { action, success: true, items_processed: processed, api_calls };
  } catch (e) {
    return { action, success: false, items_processed: 0, error_message: (e as Error).message, api_calls };
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

  // Read-only helper: haalt debiteuren op uit Informer, met bestaande koppelingen.
  if (action === "list_debtors") {
    const api_calls: ApiCall[] = [];
    try {
      const call = await informerCall("/relations/?records=100&page=0", {}, api_calls);
      if (call.error) throw new Error(`Netwerkfout: ${call.error}`);
      if (!call.ok) throw new Error(`Informer ${call.status} (req_id=${call.request_id ?? "-"})`);
      const apiError = hasInformerError(call.response_body);
      if (apiError) throw new Error(`Informer fout: ${apiError}`);
      const body: any = call.response_body ?? {};
      const raw = normalizeInformerList(body, ["relation", "relations", "data"]);
      const debtors = raw.map((d: any) => ({
        id: String(d.id ?? d.relation_number ?? ""),
        name: d.name ?? d.company_name ?? d.debtor_name ?? "",
        email: d.email_invoice ?? d.email ?? null,
        kvk: d.coc ?? d.kvk_number ?? d.chamber_of_commerce ?? d.coc_number ?? null,
        city: d.city ?? null,
      })).filter((d) => d.id);
      const { data: mapping } = await supabase
        .from("informer_debtor_map")
        .select("member_id, informer_debtor_id");
      return new Response(JSON.stringify({ success: true, debtors, mapping: mapping ?? [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message, api_calls }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const results: ActionResult[] = [];
  try {
    if (action === "pull_debtors"  || action === "all") results.push(await pullDebtors(supabase));
    if (action === "pull_invoices" || action === "all") results.push(await pullInvoices(supabase));
    if (action === "pull_creditors"|| action === "all") results.push(await pullCreditors(supabase));

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