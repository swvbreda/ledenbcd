import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth } from "@/lib/invokeFunction";
import {
  needsAttention,
  netResult,
  openSalesTotal,
  totalExpenses,
  totalRevenue,
  totalsByDossier,
  countableEntries,
  type LedgerEntry,
  type LedgerSplit,
} from "@/lib/ledger";

const client = supabase as any;

/** De canonieke financiële regels voor één boekjaar (Informer = bron van waarheid). */
export function useLedger(year: number) {
  return useQuery({
    queryKey: ["ledger", year],
    queryFn: async () => {
      const { data, error } = await client
        .from("ledger_entries_v")
        .select("*")
        .eq("year", year)
        .order("entry_date", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        ...row,
        amount_incl: Number(row.amount_incl) || 0,
        amount_excl: row.amount_excl === null ? null : Number(row.amount_excl),
        paid_amount: Number(row.paid_amount) || 0,
        open_amount: Number(row.open_amount) || 0,
      })) as LedgerEntry[];
    },
  });
}

export function useLedgerTotals(year: number) {
  const { data, isLoading, error } = useLedger(year);
  const entries = data ?? [];
  return {
    isLoading,
    error,
    entries,
    counted: countableEntries(entries),
    attention: entries.filter(needsAttention),
    totalExpenses: totalExpenses(entries),
    totalRevenue: totalRevenue(entries),
    netResult: netResult(entries),
    openSales: openSalesTotal(entries),
    byDossier: totalsByDossier(entries),
  };
}

/** Bankmutaties die (nog) niet aan een Informer-factuur hangen. Tellen nergens mee. */
export function useUnlinkedBankTransactions(year: number) {
  return useQuery({
    queryKey: ["unlinked-bank-transactions", year],
    queryFn: async () => {
      const { data: links, error: linkError } = await client
        .from("ledger_payment_links")
        .select("ponto_transaction_id");
      if (linkError) throw linkError;
      const linked = new Set<string>((links ?? []).map((l: any) => String(l.ponto_transaction_id)));

      const { data, error } = await client
        .from("ponto_transactions")
        .select("id, executed_at, amount, counterparty_name, remittance_information, dossier")
        .gte("executed_at", `${year}-01-01`)
        .lt("executed_at", `${year + 1}-01-01`)
        .order("executed_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? [])
        .filter((t: any) => !linked.has(String(t.id)))
        .map((t: any) => ({ ...t, amount: Number(t.amount) || 0 }));
    },
  });
}

export function useLedgerSplits(year: number) {
  return useQuery({
    queryKey: ["ledger-splits", year],
    queryFn: async () => {
      const { data, error } = await client
        .from("expense_dossier_splits")
        .select("*")
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as LedgerSplit[];
    },
  });
}

export function useInformerSyncState() {
  return useQuery({
    queryKey: ["informer-sync-state"],
    queryFn: async () => {
      const [{ data: state }, { data: log }] = await Promise.all([
        client.from("informer_sync_state").select("*").eq("id", 1).maybeSingle(),
        client.from("informer_sync_log").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      return { state: state ?? null, log: log ?? [] };
    },
  });
}

/** Facturen zonder koppeling naar een lid (uitzonderingenlijst i.p.v. stil overslaan). */
export function useUnmatchedSalesInvoices(year: number) {
  const { data: entries } = useLedger(year);
  return useQuery({
    queryKey: ["unmatched-sales", year, (entries ?? []).length],
    enabled: !!entries,
    queryFn: async () => {
      const { data: map, error } = await client
        .from("informer_debtor_map")
        .select("member_id, informer_debtor_id");
      if (error) throw error;
      const known = new Set<string>((map ?? []).map((r: any) => String(r.informer_debtor_id)));
      return (entries ?? []).filter(
        (e) => e.doc_type === "sales_invoice" && (!e.relation_id || !known.has(String(e.relation_id))),
      );
    },
  });
}

export function useLedgerMutations(year: number) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ledger", year] });
    qc.invalidateQueries({ queryKey: ["unlinked-bank-transactions", year] });
  };

  const setOverride = useMutation({
    mutationFn: async (input: {
      doc_type: string;
      informer_id: string;
      dossier?: string | null;
      line_item_id?: string | null;
      note?: string | null;
      excluded?: boolean;
    }) => {
      const { error } = await client
        .from("ledger_entry_overrides")
        .upsert(
          {
            doc_type: input.doc_type,
            informer_id: input.informer_id,
            ...(input.dossier !== undefined ? { dossier: input.dossier } : {}),
            ...(input.line_item_id !== undefined ? { line_item_id: input.line_item_id } : {}),
            ...(input.note !== undefined ? { note: input.note } : {}),
            ...(input.excluded !== undefined ? { excluded: input.excluded } : {}),
          },
          { onConflict: "doc_type,informer_id" },
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const linkPayment = useMutation({
    mutationFn: async (input: { doc_type: string; informer_id: string; ponto_transaction_id: string }) => {
      const { error } = await client
        .from("ledger_payment_links")
        .upsert({ ...input, matched_by: "manual" }, { onConflict: "ponto_transaction_id" });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const syncYear = useMutation({
    mutationFn: async () => {
      const { data, error } = await invokeWithAuth(
        `informer-sync?action=sync_year&year=${year}`,
        { method: "POST" },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["informer-sync-state"] });
    },
  });

  return { setOverride, linkPayment, syncYear };
}
