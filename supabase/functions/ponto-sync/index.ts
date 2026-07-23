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

async function fetchTransactions(
  token: string,
  accountId: string,
  sinceIso: string | null,
  calls: ApiCall[],
): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | null = null;
  let guard = 0;
  while (guard++ < 50) {
    const params = new URLSearchParams({ "page[limit]": "100" });
    if (cursor) params.set("page[before]", cursor);
    const url = `${PONTO_BASE}/accounts/${accountId}/transactions?${params.toString()}`;
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
    if (!resp.ok) throw new Error(`/transactions ${resp.status}: ${text.slice(0, 200)}`);
    const page: any[] = Array.isArray(json?.data) ? json.data : [];
    if (page.length === 0) break;

    let stop = false;
    for (const t of page) {
      const executedAt = t.attributes?.executionDate ?? t.attributes?.valueDate ?? null;
      if (sinceIso && executedAt && executedAt < sinceIso) { stop = true; continue; }
      all.push(t);
    }
    if (stop) break;
    const nextCursor: string | null = json?.links?.next
      ? new URL(json.links.next).searchParams.get("page[before]")
      : null;
    if (!nextCursor) break;
    cursor = nextCursor;
  }
  return all;
}

function pickMatchText(fields: Record<string, string>, field: string): string {
  if (field === "counterparty") return fields.counterparty || "";
  if (field === "description") return `${fields.description || ""} ${fields.remittance || ""}`;
  return `${fields.counterparty || ""} ${fields.description || ""} ${fields.remittance || ""}`;
}

async function applyMatchingRules(
  supabase: any,
  rows: any[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const { data: rules } = await supabase
    .from("ponto_matching_rules")
    .select("id, pattern, match_field, budget_line_item_id, dossier, priority")
    .order("priority", { ascending: true });
  const active = rules ?? [];
  if (active.length === 0) return 0;

  let matched = 0;
  for (const r of rows) {
    if (r.budget_line_item_id || r.matched_manually) continue;
    const fields = {
      counterparty: (r.counterparty_name || "").toLowerCase(),
      description: (r.description || "").toLowerCase(),
      remittance: (r.remittance_info || "").toLowerCase(),
    };
    for (const rule of active) {
      const hay = pickMatchText(fields, rule.match_field || "counterparty");
      const needle = (rule.pattern || "").toLowerCase().trim();
      if (!needle || !hay.includes(needle)) continue;
      await supabase.from("ponto_transactions").update({
        budget_line_item_id: rule.budget_line_item_id,
        dossier: rule.dossier,
        matched_rule_id: rule.id,
      }).eq("id", r.id);
      matched++;
      break;
    }
  }
  return matched;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const calls: ApiCall[] = [];

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "all"; // 'balances' | 'transactions' | 'all'

  try {
    const token = await getAccessToken(calls);
    const accounts = await fetchAccounts(token, calls);

    let balancesProcessed = 0;
    let txProcessed = 0;
    let ruleMatches = 0;

    for (const a of accounts) {
      const attr = a.attributes ?? {};
      const accountId = String(a.id ?? "").trim();
      if (!accountId) continue;

      if (action === "balances" || action === "all") {
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
        balancesProcessed++;
      }

      if (action === "transactions" || action === "all") {
        // Incremental: last synced tx per account, else Jan 1 of current year
        const { data: latest } = await supabase
          .from("ponto_transactions")
          .select("executed_at")
          .eq("account_id", accountId)
          .order("executed_at", { ascending: false })
          .limit(1);
        const currentYear = new Date().getFullYear();
        const sinceIso = latest?.[0]?.executed_at
          ?? `${currentYear}-01-01T00:00:00Z`;

        const txs = await fetchTransactions(token, accountId, sinceIso, calls);
        const rows = txs.map((t: any) => {
          const at = t.attributes ?? {};
          return {
            account_id: accountId,
            transaction_id: String(t.id ?? ""),
            executed_at: at.executionDate ?? at.valueDate ?? null,
            value_date: at.valueDate ?? null,
            amount: Number(at.amount ?? 0),
            currency: at.currency ?? "EUR",
            counterparty_name: at.counterpartName ?? null,
            counterparty_iban: at.counterpartReference ?? null,
            description: at.description ?? null,
            remittance_info: at.remittanceInformation ?? null,
            raw: t,
          };
        }).filter((r) => r.transaction_id);

        if (rows.length > 0) {
          // Upsert without overwriting user-set categorization
          const { data: upserted } = await supabase
            .from("ponto_transactions")
            .upsert(rows, { onConflict: "account_id,transaction_id", ignoreDuplicates: false })
            .select("id, budget_line_item_id, matched_manually, counterparty_name, description, remittance_info");
          txProcessed += rows.length;
          ruleMatches += await applyMatchingRules(supabase, upserted ?? []);
        }
      }
    }

    const patch: Record<string, string> = { updated_at: new Date().toISOString() };
    if (action === "balances" || action === "all") patch.last_ponto_sync_at = new Date().toISOString();
    if (action === "transactions" || action === "all") patch.last_ponto_tx_sync_at = new Date().toISOString();
    await supabase.from("informer_sync_state").update(patch).eq("id", 1);

    if (action === "balances" || action === "all") {
      await supabase.from("informer_sync_log").insert({
        action: "pull_ponto_balances",
        success: true,
        items_processed: balancesProcessed,
        details: { api_calls: action === "all" ? [] : calls },
      });
    }
    if (action === "transactions" || action === "all") {
      await supabase.from("informer_sync_log").insert({
        action: "pull_ponto_transactions",
        success: true,
        items_processed: txProcessed,
        details: { api_calls: calls, rule_matches: ruleMatches },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      action,
      items_processed: action === "transactions" ? txProcessed : balancesProcessed,
      balances_processed: balancesProcessed,
      transactions_processed: txProcessed,
      rule_matches: ruleMatches,
      api_calls: calls,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = (e as Error).message;
    await supabase.from("informer_sync_log").insert({
      action: action === "transactions" ? "pull_ponto_transactions" : "pull_ponto_balances",
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