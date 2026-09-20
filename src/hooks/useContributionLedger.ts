import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  buildContributionInvoiceRows,
  buildOtherRevenueRows,
  summarizeInvoiceRows,
  type ContributionInvoiceRow,
  type ContributionTotals,
} from "@/lib/contributionLedger";
import type { LedgerEntry } from "@/lib/ledger";

const client = supabase as any;

export interface ContributionLedgerData {
  contribution: ContributionInvoiceRow[];
  other: ContributionInvoiceRow[];
  contributionTotals: ContributionTotals;
  otherTotals: ContributionTotals;
}

/**
 * Contributiefacturen van één boekjaar uit de boekhouding, met de ledkoppeling
 * uit informer_debtor_map. Geen enkele lokale contributietabel wordt gelezen.
 */
export function useContributionLedger(year: number) {
  return useQuery({
    queryKey: ["contribution-ledger", year],
    queryFn: async (): Promise<ContributionLedgerData> => {
      const [{ data, error }, { data: debtorMap }] = await Promise.all([
        client.from("ledger_entries_v").select("*").eq("year", year).limit(5000),
        client.from("informer_debtor_map").select("member_id, informer_debtor_id"),
      ]);
      if (error) throw error;

      const memberByRelation = new Map<string, number>(
        (debtorMap ?? []).map((r: any) => [String(r.informer_debtor_id), Number(r.member_id)]),
      );
      const entries = (data ?? []) as LedgerEntry[];
      const contribution = buildContributionInvoiceRows(entries, memberByRelation);
      const other = buildOtherRevenueRows(entries, memberByRelation);
      return {
        contribution,
        other,
        contributionTotals: summarizeInvoiceRows(contribution),
        otherTotals: summarizeInvoiceRows(other),
      };
    },
  });
}

export interface MyContributionInvoice {
  member_id: number;
  invoice_number: string | null;
  entry_date: string | null;
  due_date: string | null;
  year: number;
  amount_incl: number;
  paid_amount: number;
  open_amount: number;
  status: string;
}

/**
 * De eigen contributiefacturen van het ingelogde lid. Leest via een
 * geautoriseerde databasefunctie die auth.uid() aan het gekoppelde lidnummer
 * controleert; andere leden blijven onzichtbaar.
 */
export function useMyContributionInvoices(year: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-contribution-invoices", year, user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MyContributionInvoice[]> => {
      const { data, error } = await client.rpc("get_my_contribution_invoices", { _year: year });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        amount_incl: Number(r.amount_incl) || 0,
        paid_amount: Number(r.paid_amount) || 0,
        open_amount: Number(r.open_amount) || 0,
      }));
    },
  });
}
