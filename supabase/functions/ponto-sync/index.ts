import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const PONTO_BASE = "https://api.myponto.com";

interface ApiCall {
  ts: string;
  method: string;
  url: string;
  status: number | null;
  ok: boolean;
  duration_ms: number;
  response_body?: unknown;
  error?: string;
}

async function getAccessToken(calls: ApiCall[]): Promise<string> {
  const id = Deno.env.get("PONTO_CLIENT_ID");
  const secret = Deno.env.get("PONTO_CLIENT_SECRET");
  if (!id || !secret) throw new Error("PONTO_CLIENT_ID/PONTO_CLIENT_SECRET niet ingesteld");

  const url = `${PONTO_BASE}/oauth2/token`;
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const t0 = Date.now();
  let status: number | null = null;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${id}:${secret}`),
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });
    status = resp.status;
    const text = await resp.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    calls.push({
      ts: new Date().toISOString(), method: "POST", url, status,
      ok: resp.ok, duration_ms: Date.now() - t0,
      response_body: resp.ok ? { has_token: !!json?.access_token, expires_in: json?.expires_in } : json,
    });
    if (!resp.ok || !json?.access_token) {
      throw new Error(`Token-fout (${status}): ${json?.error_description ?? json?.error ?? text.slice(0, 200)}`);
    }
    return json.access_token as string;
  } catch (e) {
    calls.push({
      ts: new Date().toISOString(), method: "POST", url, status,
      ok: false, duration_ms: Date.now() - t0, error: (e as Error).message,
    });
    throw e;
  }
}

async function fetchAccounts(token: string, calls: ApiCall[]): Promise<any[]> {
  const url = `${PONTO_BASE}/accounts`;
  const t0 = Date.now();
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await resp.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  calls.push({
    ts: new Date().toISOString(), method: "GET", url,
    status: resp.status, ok: resp.ok, duration_ms: Date.now() - t0,
    response_body: resp.ok ? { count: Array.isArray(json?.data) ? json.data.length : 0 } : json,
  });
  if (!resp.ok) throw new Error(`/accounts ${resp.status}: ${text.slice(0, 200)}`);
  return Array.isArray(json?.data) ? json.data : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const calls: ApiCall[] = [];

  try {
    const token = await getAccessToken(calls);
    const accounts = await fetchAccounts(token, calls);

    let processed = 0;
    for (const a of accounts) {
      const attr = a.attributes ?? {};
      const accountId = String(a.id ?? "").trim();
      if (!accountId) continue;

      await supabase.from("ponto_bank_balances").upsert({
        account_id: accountId,
        name: attr.description ?? attr.product ?? "Bankrekening",
        iban: attr.reference ?? null,
        available_balance: Number(attr.availableBalance ?? 0),
        current_balance: Number(attr.currentBalance ?? 0),
        currency: attr.currency ?? "EUR",
        as_of_date: attr.currentBalanceChangedAt ?? attr.availableBalanceChangedAt ?? new Date().toISOString(),
        raw: a,
        updated_at: new Date().toISOString(),
      }, { onConflict: "account_id" });
      processed++;
    }

    await supabase.from("informer_sync_state").update({
      last_ponto_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", 1);

    await supabase.from("informer_sync_log").insert({
      action: "pull_ponto_balances",
      success: true,
      items_processed: processed,
      details: { api_calls: calls },
    });

    return new Response(JSON.stringify({ success: true, items_processed: processed, api_calls: calls }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("informer_sync_log").insert({
      action: "pull_ponto_balances",
      success: false,
      items_processed: 0,
      error_message: msg,
      details: { api_calls: calls },
    });
    return new Response(JSON.stringify({ success: false, error: msg, api_calls: calls }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});