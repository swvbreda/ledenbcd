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

/**
 * Auto-matcht inkomende bankboekingen aan openstaande contributiefacturen.
 *
 * Strategie (in volgorde):
 *  1. Zoek in omschrijving/remittance naar factuurnummers uit `contribution_invoices`.
 *     Als het factuurnummer + het bedrag (±€5) klopt → match.
 *  2. Zoek naar lid-/relatienummers (bv. "#138" of "lid 138"). Als er voor dat lid
 *     dit jaar een openstaande contributiefactuur is met hetzelfde bedrag → match.
 *
 * Bij een match:
 *   • Voegt een `contribution_payments`-rij toe (method=bank, status=paid).
 *     De trigger `recompute_contribution_paid` markeert de contributie als betaald.
 *   • Categoriseert de bankboeking onder Inkomsten → Contributies van het juiste jaar.
 */
async function matchContributionPayments(supabase: any): Promise<number> {
  // Alleen inkomende, nog niet gekoppelde boekingen kandidaat maken
  const { data: pending } = await supabase
    .from("ponto_transactions")
    .select("id, executed_at, amount, counterparty_name, counterparty_iban, description, remittance_info")
    .gt("amount", 0)
    .is("budget_line_item_id", null)
    .eq("matched_manually", false)
    .order("executed_at", { ascending: false })
    .limit(500);
  const txs = pending ?? [];
  if (txs.length === 0) return 0;

  const { data: invoices } = await supabase
    .from("contribution_invoices")
    .select("id, member_id, year, invoice_number, amount");
  const invoiceList = (invoices ?? []).filter((i: any) => i.invoice_number);

  // Bepaal openstaande facturen: geen bijbehorende paid-payment
  const { data: paidPayments } = await supabase
    .from("contribution_payments")
    .select("member_id, year, amount, status");
  const paidByMemberYear = new Map<string, number>();
  for (const p of paidPayments ?? []) {
    if (p.status !== "paid") continue;
    const k = `${p.member_id}|${p.year}`;
    paidByMemberYear.set(k, (paidByMemberYear.get(k) ?? 0) + Number(p.amount));
  }

  // Contributies line items per jaar
  const { data: liRows } = await supabase
    .from("budget_line_items")
    .select("id, name, category_id, budget_categories:category_id(year, name)");
  const contribLineByYear = new Map<number, string>();
  for (const li of liRows ?? []) {
    const cat = (li as any).budget_categories;
    if (cat?.name === "Inkomsten" && li.name === "Contributies" && cat?.year != null) {
      contribLineByYear.set(Number(cat.year), li.id);
    }
  }

  // Ledenindex voor naam-matching (bedrijfsnaam / coffeeshopnaam / contactpersoon)
  const { data: memberRows } = await supabase
    .from("members_data")
    .select("id, data, member_type")
    .in("member_type", ["member", "lead"]);
  const normalizeName = (s: string) => (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(bv|b\.v\.|nv|n\.v\.|vof|v\.o\.f\.|holding|coffeeshop|coffee shop)\b/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  type MemberIdx = { id: number; keys: string[] };
  const memberIndex: MemberIdx[] = [];
  for (const m of memberRows ?? []) {
    const d = (m as any).data || {};
    const raw: string[] = [d.naam, d.bedrijfsnaam, d.factuurBedrijfsnaam, d.contactpersoon]
      .concat(Array.isArray(d.locaties) ? d.locaties.map((l: any) => l?.naam) : [])
      .filter((v: any) => typeof v === "string" && v.trim().length >= 3);
    const keys = Array.from(new Set(raw.map(normalizeName).filter((k) => k.length >= 3)));
    if (keys.length) memberIndex.push({ id: Number((m as any).id), keys });
  }

  // IBAN → member: eerst uit de lid-data (handmatig ingevoerde bankrekeningen),
  // daarna aangevuld door te leren uit al gekoppelde bankboekingen.
  const ibanToMember = new Map<string, number>();
  const memberIbans = new Map<number, Set<string>>();
  for (const m of memberRows ?? []) {
    const d: any = (m as any).data || {};
    const list: string[] = Array.isArray(d.ibans) ? d.ibans : [];
    const set = new Set<string>();
    for (const raw of list) {
      const norm = String(raw || "").replace(/\s+/g, "").toUpperCase();
      if (!norm) continue;
      set.add(norm);
      if (!ibanToMember.has(norm)) ibanToMember.set(norm, Number((m as any).id));
    }
    memberIbans.set(Number((m as any).id), set);
  }
  const learnFromRows = (rows: any[] | null | undefined) => {
    for (const r of rows ?? []) {
      const raw = (r.counterparty_iban || "").replace(/\s+/g, "").toUpperCase();
      const dossier: string = r.dossier || "";
      const mm = dossier.match(/Contributie\s*#(\d+)/i);
      if (raw && mm) ibanToMember.set(raw, Number(mm[1]));
    }
  };
  // Note: bank_transactions has no counterparty_iban column (unlike
  // ponto_transactions), so we only learn IBAN→member links from Ponto rows.
  const { data: pontoLearn } = await supabase
    .from("ponto_transactions")
    .select("counterparty_iban, dossier")
    .ilike("dossier", "Contributie #%");
  learnFromRows(pontoLearn);

  // Backfill: IBAN's die uit historische matches komen maar nog niet in de
  // lid-data staan, toevoegen aan members_data.data.ibans (idempotent).
  const membersToUpdate = new Map<number, Set<string>>();
  for (const [iban, memberId] of ibanToMember.entries()) {
    const known = memberIbans.get(memberId);
    if (!known || known.has(iban)) continue;
    if (!membersToUpdate.has(memberId)) membersToUpdate.set(memberId, new Set(known));
    membersToUpdate.get(memberId)!.add(iban);
    known.add(iban);
  }
  for (const [memberId, ibanSet] of membersToUpdate.entries()) {
    const { data: row } = await supabase
      .from("members_data")
      .select("data")
      .eq("id", memberId)
      .maybeSingle();
    const currentData: any = (row as any)?.data || {};
    const merged = Array.from(ibanSet);
    await supabase
      .from("members_data")
      .update({ data: { ...currentData, ibans: merged } })
      .eq("id", memberId);
  }

  let matched = 0;
  const AMOUNT_TOL = 5; // euro

  const findOpenInvoice = (memberId: number, amount: number) => {
    let partial: any = null;
    for (const inv of invoiceList) {
      if (inv.member_id !== memberId) continue;
      const invAmt = inv.amount != null ? Number(inv.amount) : null;
      if (invAmt == null) continue;
      const paid = paidByMemberYear.get(`${inv.member_id}|${inv.year}`) ?? 0;
      if (paid >= invAmt - AMOUNT_TOL) continue; // al voldaan
      if (Math.abs(invAmt - amount) <= AMOUNT_TOL) return inv;
      if (amount <= invAmt + AMOUNT_TOL && (!partial || inv.year > partial.year)) partial = inv;
    }
    return partial;
  };

  // Fallback: als er geen openstaande factuur meer is (bv. handmatig afgevinkt of
  // backfill), pak dan de meest recente factuur van dit lid — dan kunnen we de
  // bankboeking nog steeds categoriseren onder Contributies zonder een dubbele
  // payment in te schieten.
  const findAnyInvoice = (memberId: number) => {
    let best: any = null;
    for (const inv of invoiceList) {
      if (inv.member_id !== memberId) continue;
      if (!best || inv.year > best.year) best = inv;
    }
    return best;
  };

  const currentYear = new Date().getFullYear();

  for (const t of txs) {
    const amount = Number(t.amount);
    const hay = `${t.counterparty_name ?? ""} ${t.description ?? ""} ${t.remittance_info ?? ""}`;
    const hayLower = hay.toLowerCase();
    const iban = ((t as any).counterparty_iban || "").replace(/\s+/g, "").toUpperCase();

    let hit: { member_id: number; year: number; invoice_number: string | null; strategy: string } | null = null;
    let memberCandidate: number | null = null;

    // 1) Factuurnummer-match
    for (const inv of invoiceList) {
      const num = String(inv.invoice_number).trim();
      if (!num) continue;
      const stripped = num.replace(/[-\s]/g, "");
      const hayStripped = hayLower.replace(/[-\s]/g, "");
      const numberFound = hayStripped.includes(stripped) ||
        new RegExp(`(?<!\\d)${stripped.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d)`).test(hayStripped);
      if (!numberFound) continue;
      const invAmt = inv.amount != null ? Number(inv.amount) : null;
      if (invAmt != null && Math.abs(invAmt - amount) > AMOUNT_TOL) continue;
      hit = { member_id: inv.member_id, year: inv.year, invoice_number: num, strategy: "invoice" };
      break;
    }

    // 2) Lidnummer-match op basis van openstaande facturen met hetzelfde bedrag
    if (!hit) {
      const memberRefs = new Set<number>();
      for (const m of hayLower.matchAll(/(?:#|lid\s*|relatie\s*|deb(?:iteur)?\s*)(\d{1,4})\b/g)) {
        memberRefs.add(Number(m[1]));
      }
      if (memberRefs.size > 0) {
        for (const inv of invoiceList) {
          if (!memberRefs.has(inv.member_id)) continue;
          const invAmt = inv.amount != null ? Number(inv.amount) : null;
          if (invAmt == null || Math.abs(invAmt - amount) > AMOUNT_TOL) continue;
          const paid = paidByMemberYear.get(`${inv.member_id}|${inv.year}`) ?? 0;
          if (paid >= invAmt - AMOUNT_TOL) continue; // al voldaan
          hit = { member_id: inv.member_id, year: inv.year, invoice_number: inv.invoice_number, strategy: "member_ref" };
          break;
        }
      }
    }

    // 3) IBAN-match uit eerder gekoppelde boekingen van hetzelfde lid
    if (!hit && iban && ibanToMember.has(iban)) {
      const memberId = ibanToMember.get(iban)!;
      memberCandidate = memberId;
      const inv = findOpenInvoice(memberId, amount);
      if (inv) hit = { member_id: memberId, year: inv.year, invoice_number: inv.invoice_number, strategy: "iban" };
    }

    // 4) Naam-match op tegenpartij (coffeeshop-/bedrijfsnaam / contactpersoon)
    if (!hit) {
      const cpNorm = normalizeName(t.counterparty_name || "");
      if (cpNorm.length >= 3) {
        const matches = memberIndex.filter((m) =>
          m.keys.some((k) => cpNorm === k || cpNorm.includes(k) || k.includes(cpNorm)),
        );
        if (matches.length === 1) {
          if (memberCandidate == null) memberCandidate = matches[0].id;
          const inv = findOpenInvoice(matches[0].id, amount);
          if (inv) hit = { member_id: matches[0].id, year: inv.year, invoice_number: inv.invoice_number, strategy: "name" };
        }
      }
    }

    // 5) Fallback: geen openstaande factuur meer (al betaald), maar we weten wél
    //    aan welk lid dit ligt → alleen categoriseren, geen nieuwe payment.
    if (!hit && memberCandidate != null) {
      const inv = findAnyInvoice(memberCandidate);
      hit = {
        member_id: memberCandidate,
        year: inv?.year ?? currentYear,
        invoice_number: inv?.invoice_number ?? null,
        strategy: iban && ibanToMember.get(iban) === memberCandidate ? "iban-paid" : "name-paid",
      };
    }

    if (!hit) continue;

    // Prior-year invoice reference: als in de omschrijving een factuurnummer
    // staat dat met een ander jaar begint (bv. "2025118" op een 2026-boeking),
    // dan is dit een nabetaling op een oude factuur — categoriseer onder dat
    // vorige jaar in plaats van het lopende jaar. Voorkomt dat een €1.000
    // nabetaling op 2025 als (extra) 2026-contributie wordt geboekt.
    {
      const priorMatch = hayLower.match(/\b(20\d{2})(\d{2,4})\b/);
      if (priorMatch) {
        const refYear = Number(priorMatch[1]);
        const refNumber = priorMatch[0];
        if (refYear >= 2000 && refYear <= currentYear + 1 && refYear !== hit.year) {
          hit = {
            member_id: hit.member_id,
            year: refYear,
            invoice_number: refNumber,
            strategy: `${hit.strategy}-prior`,
          };
        }
      }
    }

    const paidAt = t.executed_at ?? new Date().toISOString();

    // Alleen een nieuwe betaling registreren als contributie nog niet volledig
    // is voldaan (voorkomt dubbeltelling na de handmatige/backfill markering).
    const alreadyPaid = paidByMemberYear.get(`${hit.member_id}|${hit.year}`) ?? 0;
    const requiredForYear = (() => {
      for (const inv of invoiceList) {
        if (inv.member_id === hit.member_id && inv.year === hit.year && inv.amount != null) return Number(inv.amount);
      }
      return 3000;
    })();
    const needsPayment = alreadyPaid < requiredForYear - AMOUNT_TOL;

    // Vermijd dubbele betaling: check of er al een bank-payment op deze dag met dit bedrag bestaat
    const { data: existing } = await supabase
      .from("contribution_payments")
      .select("id")
      .eq("member_id", hit.member_id)
      .eq("year", hit.year)
      .eq("payment_method", "bank")
      .eq("status", "paid")
      .gte("amount", amount - 0.01)
      .lte("amount", amount + 0.01)
      .limit(1);
    if (needsPayment && (existing ?? []).length === 0) {
      const { error: payErr } = await supabase.from("contribution_payments").insert({
        member_id: hit.member_id,
        year: hit.year,
        amount,
        status: "paid",
        payment_method: "bank",
        paid_at: paidAt,
      });
      if (payErr) {
        console.warn("contribution_payments insert failed", payErr);
        continue;
      }
    }

    const lineId = contribLineByYear.get(hit.year);
    await supabase
      .from("ponto_transactions")
      .update({
        budget_line_item_id: lineId ?? null,
        dossier: `Contributie #${hit.member_id}${hit.invoice_number ? ` (${hit.invoice_number})` : ""}`,
        match_strategy: hit.strategy,
      })
      .eq("id", t.id);

    // Trigger paidByMemberYear-update zodat volgende iteraties dit meenemen
    const k = `${hit.member_id}|${hit.year}`;
    paidByMemberYear.set(k, (paidByMemberYear.get(k) ?? 0) + amount);

    matched++;
    if (iban) {
      ibanToMember.set(iban, hit.member_id);
      const known = memberIbans.get(hit.member_id);
      if (known && !known.has(iban)) {
        known.add(iban);
        const { data: row } = await supabase
          .from("members_data")
          .select("data")
          .eq("id", hit.member_id)
          .maybeSingle();
        const currentData: any = (row as any)?.data || {};
        const existing: string[] = Array.isArray(currentData.ibans) ? currentData.ibans : [];
        if (!existing.includes(iban)) {
          await supabase
            .from("members_data")
            .update({ data: { ...currentData, ibans: [...existing, iban] } })
            .eq("id", hit.member_id);
        }
      }
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
    let contributionMatches = 0;

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
        const historical = url.searchParams.get("historical") === "1";
        const sinceParam = url.searchParams.get("since"); // ISO date override
        const sinceIso = historical
          ? null // walk all pages Ponto still has
          : (sinceParam
            ?? latest?.[0]?.executed_at
            ?? `${currentYear}-01-01T00:00:00Z`);

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

    if (action === "transactions" || action === "all") {
      try {
        contributionMatches = await matchContributionPayments(supabase);
      } catch (e) {
        console.warn("matchContributionPayments failed", (e as Error).message);
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
        details: { api_calls: calls, rule_matches: ruleMatches, contribution_matches: contributionMatches },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      action,
      items_processed: action === "transactions" ? txProcessed : balancesProcessed,
      balances_processed: balancesProcessed,
      transactions_processed: txProcessed,
      rule_matches: ruleMatches,
      contribution_matches: contributionMatches,
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