import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import type { Contribution, ContributionInvoice } from "@/hooks/useContributions";

export type BreakdownMode = "invoices" | "paid" | "unpaid";

interface MemberLite { id: number; naam: string; bedrijfsnaam?: string }

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: BreakdownMode;
  year: number;
  budgetedMemberCount: number;
  invoices: ContributionInvoice[];
  contributions: Contribution[];
  members: MemberLite[];
}

export default function ContributiesBreakdownDialog({
  open, onOpenChange, mode, year, budgetedMemberCount, invoices, contributions, members,
}: Props) {
  const memberMap = useMemo(() => {
    const m = new Map<number, MemberLite>();
    members.forEach((mm) => m.set(mm.id, mm));
    return m;
  }, [members]);

  const paidMap = useMemo(() => {
    const m = new Map<number, Contribution>();
    contributions.forEach((c) => { if (c.paid) m.set(c.member_id, c); });
    return m;
  }, [contributions]);

  const rows = useMemo(() => {
    return invoices
      .map((inv) => {
        const mem = memberMap.get(inv.member_id);
        const paidC = paidMap.get(inv.member_id);
        return {
          key: inv.id,
          member_id: inv.member_id,
          naam: mem?.naam ?? `Lid #${inv.member_id}`,
          invoice_number: inv.invoice_number ?? "—",
          amount: inv.amount ?? 0,
          paid: !!paidC,
          paid_date: paidC?.paid_date ?? null,
        };
      })
      .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  }, [invoices, memberMap, paidMap]);

  const filtered = useMemo(() => {
    if (mode === "paid") return rows.filter((r) => r.paid);
    if (mode === "unpaid") return rows.filter((r) => !r.paid);
    return rows;
  }, [rows, mode]);

  const total = filtered.reduce((s, r) => s + r.amount, 0);
  const invoicedCount = rows.length;
  const paidCount = rows.filter((r) => r.paid).length;
  const unpaidCount = invoicedCount - paidCount;

  const title = mode === "paid" ? "Ontvangen contributies" : mode === "unpaid" ? "Nog te ontvangen contributies" : "Alle facturen";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title} — {year}</DialogTitle>
          <DialogDescription>
            Begroot op {budgetedMemberCount} leden. Er zijn {invoicedCount} facturen verstuurd
            {invoicedCount > budgetedMemberCount && (
              <> — {invoicedCount - budgetedMemberCount} meer dan begroot doordat we tussentijds zijn gegroeid.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={() => { /* controlled via props */ }} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="invoices" disabled={mode !== "invoices"}>
              Facturen ({invoicedCount})
            </TabsTrigger>
            <TabsTrigger value="paid" disabled={mode !== "paid"}>
              Betaald ({paidCount})
            </TabsTrigger>
            <TabsTrigger value="unpaid" disabled={mode !== "unpaid"}>
              Openstaand ({unpaidCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={mode} className="flex-1 overflow-auto mt-3">
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium w-16">Nr</th>
                    <th className="px-3 py-2 text-left font-medium">Lid</th>
                    <th className="px-3 py-2 text-left font-medium">Factuurnr</th>
                    <th className="px-3 py-2 text-right font-medium">Bedrag</th>
                    <th className="px-3 py-2 text-left font-medium w-28">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Geen resultaten</td></tr>
                  ) : filtered.map((r) => (
                    <tr key={r.key} className="border-t border-border/50 hover:bg-muted/30">
                      <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{r.member_id}</td>
                      <td className="px-3 py-1.5">{r.naam}</td>
                      <td className="px-3 py-1.5 tabular-nums">{r.invoice_number}</td>
                      <td className="px-3 py-1.5 text-right"><CurrencyCell value={r.amount} /></td>
                      <td className="px-3 py-1.5">
                        {r.paid ? (
                          <span className="text-emerald-600 text-xs">✓ {r.paid_date ?? "betaald"}</span>
                        ) : (
                          <span className="text-amber-600 text-xs">Openstaand</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 font-semibold border-t border-border">
                    <td colSpan={3} className="px-3 py-2">Totaal ({filtered.length})</td>
                    <td className="px-3 py-2 text-right"><CurrencyCell value={total} /></td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Totaal getoond: <CurrencyText value={total} className="inline" />
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}