import { useMemo } from "react";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import type { BudgetCategory } from "@/hooks/useBudget";

interface Props {
  categories: BudgetCategory[];
  year: number;
}

interface DossierRow {
  dossier: string;
  entries: { date: string; creditor: string; invoice: string; amount: number; category: string }[];
  total: number;
}

export default function DossierOverzichtTab({ categories, year }: Props) {
  const dossiers = useMemo(() => {
    const map = new Map<string, DossierRow["entries"]>();

    for (const cat of categories) {
      for (const li of cat.line_items) {
        for (const exp of li.expenses) {
          const dossier = exp.dossier?.trim() || "";
          if (!dossier) continue;
          if (!map.has(dossier)) map.set(dossier, []);
          map.get(dossier)!.push({
            date: exp.expense_date || "",
            creditor: exp.creditor_name || exp.description || "–",
            invoice: exp.invoice_reference || "",
            amount: exp.amount,
            category: `${cat.name} → ${li.name}`,
          });
        }
      }
    }

    const rows: DossierRow[] = [];
    for (const [dossier, entries] of map) {
      entries.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      rows.push({ dossier, entries, total: entries.reduce((s, e) => s + e.amount, 0) });
    }
    rows.sort((a, b) => b.total - a.total);
    return rows;
  }, [categories]);

  const grandTotal = dossiers.reduce((s, d) => s + d.total, 0);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{dossiers.length} dossiers</h3>
        <span className="text-xs text-muted-foreground">
          Totaal: <CurrencyText value={grandTotal} />
        </span>
      </div>

      {dossiers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Geen dossiers gevonden voor {year}</p>
      ) : (
        dossiers.map((d) => (
          <div key={d.dossier} className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between bg-muted/40 px-3 py-1.5">
              <span className="text-sm font-semibold">{d.dossier}</span>
              <span className="text-xs font-medium tabular-nums"><CurrencyText value={d.total} /></span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="px-3 py-1 text-left font-medium w-[15%]">Datum</th>
                  <th className="px-3 py-1 text-left font-medium w-[25%]">Crediteur</th>
                  <th className="px-3 py-1 text-left font-medium w-[15%]">Factuurnr</th>
                  <th className="px-3 py-1 text-left font-medium w-[30%]">Begrotingspost</th>
                  <th className="px-3 py-1 text-right font-medium w-[15%]">Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {d.entries.map((e, i) => (
                  <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                    <td className="px-3 py-1 tabular-nums whitespace-nowrap">{e.date || "–"}</td>
                    <td className="px-3 py-1">{e.creditor}</td>
                    <td className="px-3 py-1 tabular-nums">{e.invoice || "–"}</td>
                    <td className="px-3 py-1 text-muted-foreground">{e.category}</td>
                    <td className="px-3 py-1 text-right"><CurrencyCell value={e.amount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
