// Ophalen van de bestaande administratie (budget_expenses en ponto_transactions)
// die als toewijzingsbron dient naast de canonieke Informer-regels.

import { supabase } from "@/integrations/supabase/client";
import type { LegacyRecord } from "@/lib/ledgerLegacy";

const client = supabase as any;

/** Bestaande boekingen en bankmutaties van een boekjaar als toewijzingsbron. */
export async function fetchLegacyRecords(year: number, lineItemIds: string[]): Promise<LegacyRecord[]> {
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;

  const [{ data: expenses, error: expErr }, { data: ponto, error: pontoErr }] = await Promise.all([
    lineItemIds.length > 0
      ? client
          .from("budget_expenses")
          .select(
            "id, line_item_id, description, amount, expense_date, creditor_name, invoice_reference, dossier, direction, external_id",
          )
          .in("line_item_id", lineItemIds)
          .limit(5000)
      : Promise.resolve({ data: [], error: null }),
    client
      .from("ponto_transactions")
      .select(
        "id, executed_at, value_date, amount, counterparty_name, description, remittance_info, dossier, budget_line_item_id",
      )
      .gte("executed_at", from)
      .lt("executed_at", to)
      .limit(5000),
  ]);
  if (expErr) throw expErr;
  if (pontoErr) throw pontoErr;

  const records: LegacyRecord[] = [];

  for (const e of expenses || []) {
    records.push({
      key: `expense:${e.id}`,
      kind: "expense",
      id: String(e.id),
      externalId: e.external_id ? String(e.external_id) : null,
      invoice: e.invoice_reference ?? null,
      description: e.description ?? null,
      counterparty: e.creditor_name ?? null,
      date: e.expense_date ?? null,
      amount: Math.abs(Number(e.amount) || 0),
      direction: e.direction === "in" ? "in" : "out",
      lineItemId: e.line_item_id ? String(e.line_item_id) : null,
      dossier: e.dossier ? String(e.dossier).trim() || null : null,
    });
  }

  for (const t of ponto || []) {
    const amount = Number(t.amount) || 0;
    records.push({
      key: `ponto:${t.id}`,
      kind: "ponto",
      id: String(t.id),
      externalId: null,
      invoice: t.remittance_info ?? null,
      description: t.description ?? t.remittance_info ?? null,
      counterparty: t.counterparty_name ?? null,
      date: (t.value_date || t.executed_at) ? String(t.value_date || t.executed_at).slice(0, 10) : null,
      amount: Math.abs(amount),
      direction: amount >= 0 ? "in" : "out",
      lineItemId: t.budget_line_item_id ? String(t.budget_line_item_id) : null,
      dossier: t.dossier ? String(t.dossier).trim() || null : null,
    });
  }

  return records;
}
