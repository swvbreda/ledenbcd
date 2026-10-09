import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { matchBankToInvoices, writableBankLinks, type MatchResult } from "@/lib/bankInvoiceMatch";
import { planMemberLinks, type MemberLinkResult } from "@/lib/memberInvoiceLink";
import { isSourceSnapshotId } from "@/lib/ledgerSource";
import { duplicateReceipts, expenseEntries } from "@/lib/ledger";

const client = supabase as any;

async function all<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export interface AdministratiePlan {
  bank: MatchResult[];
  members: MemberLinkResult[];
  expensesWithoutPost: number;
  expensesWithoutDossier: number;
  duplicateReceipts: number;
  salesInList: number;
  contributionsWithNumber: number;
  snapshotSales: number;
  snapshotAt: string | null;
}

/** Berekent het koppelplan uit actuele databasegegevens. */
export async function loadAdministratiePlan(year: number, memberNames?: Map<number, string>): Promise<AdministratiePlan> {
  const [ledger, txs, links, contribs, debtors] = await Promise.all([
    all<any>((f, t) => client.from("ledger_entries_v").select("*").order("id").range(f, t)),
    all<any>((f, t) => client.from("ponto_transactions").select("id, executed_at, amount, remittance_info, description")
      .gte("executed_at", `${year}-01-01`).lt("executed_at", `${year + 1}-01-01`).order("id").range(f, t)),
    all<any>((f, t) => client.from("ledger_payment_links").select("doc_type, informer_id, ponto_transaction_id").order("id").range(f, t)),
    all<any>((f, t) => client.from("member_contributions").select("id, member_id, year, amount, invoice_number, external_invoice_id").eq("year", year).order("id").range(f, t)),
    all<any>((f, t) => client.from("informer_debtor_map").select("member_id, informer_debtor_id").order("member_id").range(f, t)),
  ]);
  const invoices = ledger.map((e: any) => ({ ...e, amount_incl: Number(e.amount_incl) || 0 }));
  const yearRows = invoices.filter((e: any) => e.year === year);
  const exp = expenseEntries(yearRows);
  return {
    bank: matchBankToInvoices(txs.map((t: any) => ({ ...t, amount: Number(t.amount) || 0 })), invoices, links, year),
    members: planMemberLinks(yearRows.filter((e: any) => e.doc_type === "sales_invoice"), contribs, debtors, year, memberNames),
    expensesWithoutPost: exp.filter((e: any) => !e.line_item_id).length,
    expensesWithoutDossier: exp.filter((e: any) => !String(e.dossier ?? "").trim()).length,
    duplicateReceipts: duplicateReceipts(yearRows).length,
    salesInList: yearRows.filter((e: any) => e.doc_type === "sales_invoice" && !e.deleted_at).length,
    snapshotSales: yearRows.filter((e: any) => e.doc_type === "sales_invoice" && !e.deleted_at && isSourceSnapshotId(e.informer_id)).length,
    snapshotAt: yearRows.filter((e: any) => isSourceSnapshotId(e.informer_id)).map((e: any) => e.last_synced_at).filter(Boolean).sort().pop() ?? null,
    contributionsWithNumber: contribs.filter((c: any) => String(c.invoice_number ?? "").trim()).length,
  };
}

/** Koppeloverzicht: alleen lezen. Leesfouten worden doorgegeven, nooit als nul getoond. */
export function useAdministratiePlan(year: number, memberNames?: Map<number, string>) {
  return useQuery({
    queryKey: ["administratie-plan", year, memberNames?.size ?? 0],
    queryFn: () => loadAdministratiePlan(year, memberNames),
  });
}

/**
 * "Administratie bijwerken": haalt eerst het jaar opnieuw uit Informer (alleen lezen
 * daar) en legt dan uitsluitend eenduidige koppelingen vast in het ledenbestand.
 * Wijzigt nooit betaalstatus, posten, dossiers of bestaande koppelingen.
 */
export function useAdministratieBijwerken(year: number, syncYear: () => Promise<unknown>, memberNames?: Map<number, string>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await syncYear();
      // Plan opnieuw uit verse gegevens NA de sync; nooit het eerder getoonde plan schrijven.
      const fresh = await loadAdministratiePlan(year, memberNames);
      const { data: auth } = await supabase.auth.getUser();
      let bankLinked = 0, skipped = 0;
      for (const l of writableBankLinks(fresh.bank)) {
        // Vlak vóór schrijven: factuur bestaat nog en is niet intussen (handmatig) gekoppeld.
        const [{ data: inv, error: e1 }, { data: existing, error: e2 }] = await Promise.all([
          client.from("informer_ledger_entries").select("amount_incl, year, deleted_at").eq("doc_type", l.doc_type).eq("informer_id", l.informer_id).maybeSingle(),
          client.from("ledger_payment_links").select("id").or(`ponto_transaction_id.eq.${l.ponto_transaction_id},and(doc_type.eq.${l.doc_type},informer_id.eq.${l.informer_id})`).limit(1),
        ]);
        if (e1 || e2) throw e1 ?? e2;
        const planned = fresh.bank.find((r) => r.tx.id === l.ponto_transaction_id)!;
        if (!inv || inv.deleted_at || inv.year !== year || Math.abs(Number(inv.amount_incl) - Math.abs(planned.tx.amount)) >= 0.005 || (existing ?? []).length > 0) { skipped++; continue; }
        const { data, error } = await client.from("ledger_payment_links")
          .upsert({ ...l, matched_by: "auto", confidence: 1, created_by: auth?.user?.id ?? null }, { onConflict: "ponto_transaction_id", ignoreDuplicates: true }).select("id");
        if (error) throw error;
        bankLinked += (data ?? []).length;
      }
      let membersLinked = 0;
      for (const r of fresh.members.filter((m) => m.outcome === "propose")) {
        const { data, error } = await client.from("member_contributions")
          .update({ external_invoice_id: r.entry.informer_id })
          .eq("id", r.contribution!.id).is("external_invoice_id", null).eq("amount", r.contribution!.amount).select("id");
        if (error) throw error;
        if ((data ?? []).length) membersLinked++; else skipped++;
      }
      return { bankLinked, membersLinked, skipped };
    },
    onSuccess: () => {
      for (const k of ["administratie-plan", "ledger", "unlinked-bank-transactions", "financial-result", "informer-sync-state"]) qc.invalidateQueries({ queryKey: [k] });
    },
  });
}
