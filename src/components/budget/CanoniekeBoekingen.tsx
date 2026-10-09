import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { CurrencyText } from "@/components/budget/CurrencyAmount";
import { useLedgerTotals } from "@/hooks/useLedger";

/** Inkomsten/uitgaven uit dezelfde canonieke Informer-set als dashboard en dossiers. */
export default function CanoniekeBoekingen({ year }: { year: number }) {
  const t = useLedgerTotals(year);
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const list = [...t.revenues, ...t.expenses];
    const s = q.trim().toLowerCase();
    return (s ? list.filter((e) => `${e.relation_name ?? ""} ${e.invoice_number ?? ""} ${e.description ?? ""} ${e.dossier ?? ""}`.toLowerCase().includes(s)) : list)
      .sort((a, b) => String(b.entry_date ?? "").localeCompare(String(a.entry_date ?? "")));
  }, [t.revenues, t.expenses, q]);

  if (t.isLoading) return <div className="border border-border rounded-lg bg-card p-4 text-sm text-muted-foreground">Boekingen laden…</div>;
  if (t.error) return <div role="alert" className="border border-brand-red rounded-lg bg-card p-4 text-sm text-brand-red">Boekingen konden niet worden geladen: {(t.error as any)?.message}. Dit is géén lege administratie.</div>;

  return (
    <div className="border border-border rounded-lg bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Boekingen {year} volgens Informer</h3>
          <p className="text-xs text-muted-foreground">
            Inkomsten <CurrencyText value={t.totalRevenue} /> ({t.revenues.length}) · Uitgaven <CurrencyText value={t.totalExpenses} /> ({t.expenses.length})
          </p>
        </div>
        <Input className="max-w-xs" placeholder="Zoeken…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="text-xs text-muted-foreground text-left">
            <tr><th className="py-1 pr-2">Datum</th><th className="pr-2">Soort</th><th className="pr-2">Relatie</th><th className="pr-2">Nummer</th><th className="pr-2">Dossier</th><th className="pr-2">Status</th><th className="text-right">Bedrag</th></tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="py-1 pr-2 tabular-nums">{e.entry_date ?? ""}</td>
                <td className="pr-2">{e.doc_type === "sales_invoice" ? "Verkoop" : e.doc_type === "receipt" ? "Bonnetje" : "Inkoop"}</td>
                <td className="pr-2">{e.relation_name ?? ""}</td>
                <td className="pr-2">{e.invoice_number ?? e.informer_id}</td>
                <td className="pr-2">{e.dossier ?? ""}</td>
                <td className="pr-2">{e.status === "paid" ? "Betaald (Informer)" : "Open (Informer)"}{e.ponto_transaction_id ? " · bank gekoppeld" : ""}</td>
                <td className="text-right"><CurrencyText value={e.amount_incl} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
