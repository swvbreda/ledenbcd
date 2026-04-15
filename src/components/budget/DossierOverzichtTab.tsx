import { useMemo, useState } from "react";
import { Pencil, Check, X, Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  currentDossier: string;
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
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newDossierName, setNewDossierName] = useState("");
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState("");

  // All expenses flat list
  const allExpenses = useMemo(() => {
    const list: DossierEntry[] = [];
    for (const cat of categories) {
      for (const li of cat.line_items) {
        for (const exp of li.expenses) {
          list.push({
            id: exp.id,
            date: exp.expense_date || "",
            creditor: exp.creditor_name || exp.description || "–",
            invoice: exp.invoice_reference || "",
            amount: exp.amount,
            categoryName: cat.name,
            lineItemName: li.name,
            currentDossier: exp.dossier?.trim() || "",
          });
        }
      }
    }
    list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    return list;
  }, [categories]);

  const dossiers = useMemo(() => {
    const map = new Map<string, DossierEntry[]>();
    for (const e of allExpenses) {
      if (!e.currentDossier) continue;
      if (!map.has(e.currentDossier)) map.set(e.currentDossier, []);
      map.get(e.currentDossier)!.push(e);
    }
    const rows: DossierRow[] = [];
    for (const [dossier, entries] of map) {
      rows.push({ dossier, entries, total: entries.reduce((s, e) => s + e.amount, 0) });
    }
    rows.sort((a, b) => b.total - a.total);
    return rows;
  }, [allExpenses]);

  const grandTotal = dossiers.reduce((s, d) => s + d.total, 0);

  // Expenses available for the new dossier dialog (no dossier yet)
  const unassignedExpenses = useMemo(() => {
    const lowerFilter = searchFilter.toLowerCase();
    return allExpenses.filter((e) => {
      if (e.currentDossier) return false;
      if (!lowerFilter) return true;
      return (
        e.creditor.toLowerCase().includes(lowerFilter) ||
        e.invoice.toLowerCase().includes(lowerFilter) ||
        e.categoryName.toLowerCase().includes(lowerFilter) ||
        e.lineItemName.toLowerCase().includes(lowerFilter)
      );
    });
  }, [allExpenses, searchFilter]);

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

  const openNewDialog = () => {
    setNewDossierName("");
    setSelectedExpenseIds(new Set());
    setSearchFilter("");
    setShowNewDialog(true);
  };

  const toggleExpense = (id: string) => {
    setSelectedExpenseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createDossier = () => {
    if (!onUpdateExpense || !newDossierName.trim() || selectedExpenseIds.size === 0) return;
    for (const id of selectedExpenseIds) {
      onUpdateExpense(id, { dossier: newDossierName.trim() });
    }
    setShowNewDialog(false);
  };

  const selectedTotal = useMemo(() => {
    return allExpenses.filter((e) => selectedExpenseIds.has(e.id)).reduce((s, e) => s + e.amount, 0);
  }, [allExpenses, selectedExpenseIds]);

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{dossiers.length} dossiers</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Totaal: <CurrencyText value={grandTotal} />
          </span>
          {onUpdateExpense && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={openNewDialog}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nieuw dossier
            </Button>
          )}
        </div>
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

      {/* Delete confirmation */}
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

      {/* New dossier dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nieuw dossier aanmaken</DialogTitle>
            <DialogDescription>Geef het dossier een naam en selecteer de uitgaven die je wilt koppelen.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Dossiernaam</label>
              <Input
                value={newDossierName}
                onChange={(e) => setNewDossierName(e.target.value)}
                placeholder="Bijv. Advocaatkosten 2025"
                autoFocus
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Uitgaven zonder dossier ({unassignedExpenses.length})</label>
                {selectedExpenseIds.size > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {selectedExpenseIds.size} geselecteerd · <CurrencyText value={selectedTotal} />
                  </span>
                )}
              </div>
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Zoek op crediteur, factuurnr, categorie…"
                className="mb-2 h-8 text-sm"
              />
              <ScrollArea className="h-[300px] border border-border rounded-md">
                {unassignedExpenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 text-center">
                    {searchFilter ? "Geen resultaten" : "Alle uitgaven zijn al aan een dossier gekoppeld"}
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background z-10">
                      <tr className="border-b border-border/50">
                        <th className="px-2 py-1.5 w-8"></th>
                        <th className="px-2 py-1.5 text-left font-medium">Datum</th>
                        <th className="px-2 py-1.5 text-left font-medium">Crediteur</th>
                        <th className="px-2 py-1.5 text-left font-medium">Factuurnr</th>
                        <th className="px-2 py-1.5 text-left font-medium">Categorie</th>
                        <th className="px-2 py-1.5 text-right font-medium">Bedrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unassignedExpenses.map((e) => (
                        <tr
                          key={e.id}
                          className="border-b border-border/30 hover:bg-muted/20 cursor-pointer"
                          onClick={() => toggleExpense(e.id)}
                        >
                          <td className="px-2 py-1">
                            <Checkbox
                              checked={selectedExpenseIds.has(e.id)}
                              onCheckedChange={() => toggleExpense(e.id)}
                            />
                          </td>
                          <td className="px-2 py-1 tabular-nums whitespace-nowrap">{e.date || "–"}</td>
                          <td className="px-2 py-1">{e.creditor}</td>
                          <td className="px-2 py-1 tabular-nums">{e.invoice || "–"}</td>
                          <td className="px-2 py-1 text-muted-foreground">{e.categoryName}</td>
                          <td className="px-2 py-1 text-right tabular-nums"><CurrencyCell value={e.amount} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>Annuleren</Button>
            <Button
              onClick={createDossier}
              disabled={!newDossierName.trim() || selectedExpenseIds.size === 0}
            >
              Dossier aanmaken ({selectedExpenseIds.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
