import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import type { Contribution, ContributionInvoice, ContributionPayment } from "@/hooks/useContributions";

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
  payments?: ContributionPayment[];
  members: MemberLite[];
}

export default function ContributiesBreakdownDialog({
  open, onOpenChange, mode, year, budgetedMemberCount, invoices, contributions, payments = [], members,
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

  const paymentsByMember = useMemo(() => {
    const m = new Map<number, { amount: number; paidDate: string | null }>();
    payments.forEach((p) => {
      const current = m.get(p.member_id) ?? { amount: 0, paidDate: null };
      const paidDate = p.paid_at
        ? (!current.paidDate || p.paid_at > current.paidDate ? p.paid_at : current.paidDate)
        : current.paidDate;
      m.set(p.member_id, { amount: current.amount + (Number(p.amount) || 0), paidDate });
    });
    return m;
  }, [payments]);

  const contribByMember = useMemo(() => {
    const m = new Map<number, Contribution>();
    contributions.forEach((c) => m.set(c.member_id, c));
    return m;
  }, [contributions]);

  const fmtDate = (d?: string | null) => {
    if (!d) return "—";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const rows = useMemo(() => {
    return invoices
      .map((inv) => {
        const mem = memberMap.get(inv.member_id);
        const paidC = paidMap.get(inv.member_id);
        const contrib = contribByMember.get(inv.member_id);
        const invoice_date = inv.invoice_date ?? contrib?.invoice_date ?? inv.created_at ?? null;
        const invoiceAmount = Number(inv.amount ?? contrib?.amount ?? 0) || 0;
        const payment = paymentsByMember.get(inv.member_id);
        const paidAmount = payment?.amount ?? (paidC ? invoiceAmount : 0);
        const openAmount = Math.max(0, invoiceAmount - paidAmount);
        const paid = paidAmount >= invoiceAmount - 0.01 || !!paidC;
        return {
          key: inv.id,
          member_id: inv.member_id,
          naam: mem?.naam ?? `Lid #${inv.member_id}`,
          invoice_number: inv.invoice_number ?? "—",
          invoice_date,
          amount: invoiceAmount,
          paidAmount,
          openAmount,
          paid,
          paid_date: payment?.paidDate ?? paidC?.paid_date ?? null,
        };
      })
      .sort((a, b) => {
        const da = a.invoice_date ? new Date(a.invoice_date).getTime() : 0;
        const db = b.invoice_date ? new Date(b.invoice_date).getTime() : 0;
        if (db !== da) return db - da;
        return a.naam.localeCompare(b.naam, "nl");
      });
  }, [invoices, memberMap, paidMap, contribByMember, paymentsByMember]);

  const filtered = useMemo(() => {
    if (mode === "paid") return rows.filter((r) => r.paidAmount > 0);
    if (mode === "unpaid") return rows.filter((r) => r.openAmount > 0.01);
    return rows;
  }, [rows, mode]);

  const total = filtered.reduce((s, r) => {
    if (mode === "paid") return s + r.paidAmount;
    if (mode === "unpaid") return s + r.openAmount;
    return s + r.amount;
  }, 0);
  const invoicedCount = rows.length;
  const paidCount = rows.filter((r) => r.paidAmount > 0).length;
  const unpaidCount = rows.filter((r) => r.openAmount > 0.01).length;

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
                    <th className="px-3 py-2 text-left font-medium w-28">Factuurdatum</th>
                    <th className="px-3 py-2 text-right font-medium">Bedrag</th>
                    <th className="px-3 py-2 text-left font-medium w-28">Betaaldatum</th>
                    <th className="px-3 py-2 text-left font-medium w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Geen resultaten</td></tr>
                  ) : filtered.map((r) => (
                    <tr key={r.key} className="border-t border-border/50 hover:bg-muted/30">
                      <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{r.member_id}</td>
                      <td className="px-3 py-1.5">{r.naam}</td>
                      <td className="px-3 py-1.5 tabular-nums">{r.invoice_number}</td>
                      <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{fmtDate(r.invoice_date)}</td>
                      <td className="px-3 py-1.5 text-right">
                        <CurrencyCell value={mode === "paid" ? r.paidAmount : mode === "unpaid" ? r.openAmount : r.amount} />
                      </td>
                      <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{r.paid ? fmtDate(r.paid_date) : "—"}</td>
                      <td className="px-3 py-1.5">
                        {r.paid ? (
                          <span className="text-emerald-600 text-xs font-medium">Betaald</span>
                        ) : (
                          <span className="text-amber-600 text-xs font-medium">Open</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 font-semibold border-t border-border">
                    <td colSpan={4} className="px-3 py-2">Totaal ({filtered.length})</td>
                    <td className="px-3 py-2 text-right"><CurrencyCell value={total} /></td>
                    <td colSpan={2} />
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