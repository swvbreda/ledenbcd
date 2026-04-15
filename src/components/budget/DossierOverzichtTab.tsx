import { useMemo, useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import type { BudgetCategory } from "@/hooks/useBudget";

interface Props {
  categories: BudgetCategory[];
  year: number;
  onUpdateExpense?: (id: string, fields: { dossier?: string | null }) => void;
}

interface DossierEntry {
  id: string;
  date: string;
  creditor: string;
  invoice: string;
  amount: number;
  categoryName: string;
  lineItemName: string;
}

interface DossierRow {
  dossier: string;
  entries: DossierEntry[];
  total: number;
}

export default function DossierOverzichtTab({ categories, year, onUpdateExpense }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const dossiers = useMemo(() => {
    const map = new Map<string, DossierEntry[]>();

    for (const cat of categories) {
      for (const li of cat.line_items) {
        for (const exp of li.expenses) {
          const dossier = exp.dossier?.trim() || "";
          if (!dossier) continue;
          if (!map.has(dossier)) map.set(dossier, []);
          map.get(dossier)!.push({
            id: exp.id,
            date: exp.expense_date || "",
            creditor: exp.creditor_name || exp.description || "–",
            invoice: exp.invoice_reference || "",
            amount: exp.amount,
            categoryName: cat.name,
            lineItemName: li.name,
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

  const startEdit = (id: string, currentDossier: string) => {
    setEditingId(id);
    setEditValue(currentDossier);
  };

  const saveEdit = (dossierName: string) => {
    if (!editingId || !onUpdateExpense) return;
    const newVal = editValue.trim() || null;
    onUpdateExpense(editingId, { dossier: newVal });
    setEditingId(null);
  };

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
                  <th className="px-3 py-1 text-left font-medium w-[20%]">Begrotingspost</th>
                  <th className="px-3 py-1 text-left font-medium w-[15%]">Dossier</th>
                  <th className="px-3 py-1 text-right font-medium w-[10%]">Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {d.entries.map((e) => {
                  const isEditing = editingId === e.id;
                  return (
                    <tr key={e.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="px-3 py-1 tabular-nums whitespace-nowrap">{e.date || "–"}</td>
                      <td className="px-3 py-1">{e.creditor}</td>
                      <td className="px-3 py-1 tabular-nums">{e.invoice || "–"}</td>
                      <td className="px-3 py-1 text-muted-foreground">{e.category}</td>
                      <td className="px-3 py-1">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editValue}
                              onChange={(ev) => setEditValue(ev.target.value)}
                              className="h-6 text-xs"
                              autoFocus
                              onKeyDown={(ev) => {
                                if (ev.key === "Enter") saveEdit(d.dossier);
                                if (ev.key === "Escape") setEditingId(null);
                              }}
                            />
                            <button onClick={() => saveEdit(d.dossier)} className="p-0.5 text-green-600 hover:text-green-700">
                              <Check size={12} />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-0.5 text-muted-foreground hover:text-destructive">
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 group">
                            {d.dossier}
                            {onUpdateExpense && (
                              <button
                                onClick={() => startEdit(e.id, d.dossier)}
                                className="p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
                              >
                                <Pencil size={10} />
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1 text-right"><CurrencyCell value={e.amount} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  );
}
