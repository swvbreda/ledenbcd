import { useMemo, useState } from "react";
import { Pencil, Check, X, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const [editingDossier, setEditingDossier] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingDossier, setDeletingDossier] = useState<DossierRow | null>(null);

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

  const startRename = (dossier: string) => {
    setEditingDossier(dossier);
    setEditValue(dossier);
  };

  const saveRename = (row: DossierRow) => {
    if (!onUpdateExpense) return;
    const newVal = editValue.trim();
    if (!newVal || newVal === row.dossier) {
      setEditingDossier(null);
      return;
    }
    for (const entry of row.entries) {
      onUpdateExpense(entry.id, { dossier: newVal });
    }
    setEditingDossier(null);
  };

  const confirmDelete = () => {
    if (!deletingDossier || !onUpdateExpense) return;
    for (const entry of deletingDossier.entries) {
      onUpdateExpense(entry.id, { dossier: null });
    }
    setDeletingDossier(null);
  };

  const removeEntry = (entryId: string) => {
    if (!onUpdateExpense) return;
    onUpdateExpense(entryId, { dossier: null });
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
            <div className="flex items-center justify-between bg-muted/40 px-3 py-1.5 gap-2">
              {editingDossier === d.dossier ? (
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="h-7 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(d);
                      if (e.key === "Escape") setEditingDossier(null);
                    }}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => saveRename(d)}>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setEditingDossier(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="text-sm font-semibold truncate">{d.dossier}</span>
                  {onUpdateExpense && (
                    <>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => startRename(d.dossier)}>
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setDeletingDossier(d)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              )}
              <span className="text-xs font-medium tabular-nums whitespace-nowrap"><CurrencyText value={d.total} /></span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="px-3 py-1 text-left font-medium w-[15%]">Datum</th>
                  <th className="px-3 py-1 text-left font-medium w-[24%]">Crediteur</th>
                  <th className="px-3 py-1 text-left font-medium w-[14%]">Factuurnr</th>
                  <th className="px-3 py-1 text-left font-medium w-[17%]">Categorie</th>
                  <th className="px-3 py-1 text-left font-medium w-[16%]">Begrotingspost</th>
                  <th className="px-3 py-1 text-right font-medium w-[10%]">Bedrag</th>
                  {onUpdateExpense && <th className="px-1 py-1 w-[4%]"></th>}
                </tr>
              </thead>
              <tbody>
                {d.entries.map((e) => (
                  <tr key={e.id} className="border-b border-border/30 hover:bg-muted/20 group">
                    <td className="px-3 py-1 tabular-nums whitespace-nowrap">{e.date || "–"}</td>
                    <td className="px-3 py-1">{e.creditor}</td>
                    <td className="px-3 py-1 tabular-nums">{e.invoice || "–"}</td>
                    <td className="px-3 py-1 text-muted-foreground">{e.categoryName}</td>
                    <td className="px-3 py-1 text-muted-foreground">{e.lineItemName}</td>
                    <td className="px-3 py-1 text-right"><CurrencyCell value={e.amount} /></td>
                    {onUpdateExpense && (
                      <td className="px-1 py-1 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeEntry(e.id)}
                          title="Verwijder uit dossier"
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      <AlertDialog open={!!deletingDossier} onOpenChange={(open) => !open && setDeletingDossier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dossier verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je dossier "{deletingDossier?.dossier}" wilt verwijderen?
              De {deletingDossier?.entries.length} uitgaven worden niet verwijderd, maar de dossierkoppeling wordt losgemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
