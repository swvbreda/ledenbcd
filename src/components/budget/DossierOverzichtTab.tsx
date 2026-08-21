import { useMemo, useState } from "react";
import { Pencil, Check, X, Trash2, Plus, Paperclip, ChevronRight } from "lucide-react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDossierMutations,
  useDossierMutationActions,
  useExpenseDocuments,
  groupByDossier,
  isUnassigned,
  dedupeEntries,
  type DedupedEntry,
  type DossierMutation,
  type DossierEntry,
} from "@/hooks/useDossiers";
import { isContributionDossier } from "@/lib/budgetExclusions";
import { useAuth } from "@/hooks/useAuth";
import DossierDetailDialog from "@/components/budget/DossierDetailDialog";

interface Props {
  categories: BudgetCategory[];
  year: number;
  onUpdateExpense?: (id: string, fields: { dossier?: string | null }) => void;
  onUpdateBankTransaction?: (id: string, fields: { dossier?: string | null }) => void;
}

interface DossierRow {
  dossier: string;
  entries: DedupedEntry[];
  out: number;
  income: number;
  total: number;
}

const formatDate = (value: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function DossierOverzichtTab({ year }: Props) {
  const { isAdmin } = useAuth();
  const { data: mutations = [], isLoading } = useDossierMutations(year);
  const { data: documents = [] } = useExpenseDocuments();
  const { setDossier } = useDossierMutationActions(year);

  const [editingDossier, setEditingDossier] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingDossier, setDeletingDossier] = useState<DossierRow | null>(null);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newDossierName, setNewDossierName] = useState("");
  const [existingDossier, setExistingDossier] = useState<string>("");
  const [dossierMode, setDossierMode] = useState<"existing" | "new">("existing");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState("");
  const [openDossier, setOpenDossier] = useState<string | null>(null);

  const canEdit = isAdmin;

  const dossiers = useMemo(() => {
    const map = groupByDossier(mutations);
    const rows: DossierRow[] = [];
    for (const [dossier, groupEntries] of map) {
      if (isContributionDossier(dossier)) continue;
      const entries = dedupeEntries(groupEntries);
      const out = entries.filter((e) => e.direction === "out").reduce((s, e) => s + e.shareAmount, 0);
      const income = entries.filter((e) => e.direction === "in").reduce((s, e) => s + e.shareAmount, 0);
      rows.push({ dossier, entries, out, income, total: out - income });
    }
    rows.sort((a, b) => b.total - a.total);
    return rows;
  }, [mutations]);


  const docsByEntry = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of documents) map.set(d.entry_key, (map.get(d.entry_key) || 0) + 1);
    return map;
  }, [documents]);

  const grandTotal = dossiers.reduce((s, d) => s + d.total, 0);

  const unassigned = useMemo(() => {
    const lower = searchFilter.toLowerCase();
    return mutations.filter((e) => {
      if (!isUnassigned(e)) return false;
      if (!lower) return true;
      return (
        e.counterparty.toLowerCase().includes(lower) ||
        e.description.toLowerCase().includes(lower) ||
        e.invoice.toLowerCase().includes(lower) ||
        e.categoryName.toLowerCase().includes(lower) ||
        e.lineItemName.toLowerCase().includes(lower)
      );
    });
  }, [mutations, searchFilter]);

  const applyDossier = (entries: DossierMutation[], dossier: string | null) => {
    if (!canEdit || entries.length === 0) return;
    setDossier.mutate(
      { entries, dossier },
      {
        onSuccess: () => toast.success("Dossier bijgewerkt"),
        onError: (e: any) => toast.error(e?.message || "Bijwerken mislukt"),
      },
    );
  };

  const startRename = (dossier: string) => {
    setEditingDossier(dossier);
    setEditValue(dossier);
  };

  const saveRename = (row: DossierRow) => {
    const newVal = editValue.trim();
    if (!newVal || newVal === row.dossier) {
      setEditingDossier(null);
      return;
    }
    applyDossier(row.entries, newVal);
    setEditingDossier(null);
  };

  const confirmDelete = () => {
    if (!deletingDossier) return;
    applyDossier(deletingDossier.entries, null);
    setDeletingDossier(null);
  };

  const openNewDialog = (mode: "existing" | "new" = "existing") => {
    setNewDossierName("");
    setExistingDossier("");
    setSelectedIds(new Set());
    setSearchFilter("");
    setDossierMode(dossiers.length === 0 ? "new" : mode);
    setShowNewDialog(true);
  };

  const toggleEntry = (key: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const createDossier = () => {
    const targetName = dossierMode === "new" ? newDossierName.trim() : existingDossier.trim();
    if (!targetName || selectedIds.size === 0) return;
    applyDossier(
      mutations.filter((e) => selectedIds.has(e.key)),
      targetName,
    );
    setShowNewDialog(false);
  };

  const selectedTotal = useMemo(
    () => mutations.filter((e) => selectedIds.has(e.key)).reduce((s, e) => s + e.amount, 0),
    [mutations, selectedIds],
  );

  const activeRow = openDossier ? dossiers.find((d) => d.dossier === openDossier) : null;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{dossiers.length} dossiers</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Totaal: <CurrencyText value={grandTotal} />
          </span>
          {canEdit && (
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openNewDialog("new")}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Nieuw dossier
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Laden…</p>
      ) : dossiers.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Geen dossiers gevonden voor {year}</p>
      ) : (
        dossiers.map((d) => (
          <div key={d.dossier} className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center justify-between gap-2 bg-muted/40 px-3 py-1.5">
              {editingDossier === d.dossier ? (
                <div className="flex flex-1 items-center gap-1">
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
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-1 text-sm font-semibold hover:text-brand-red"
                    onClick={() => setOpenDossier(d.dossier)}
                    title="Dossier openen"
                  >
                    <span className="truncate">{d.dossier}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  </button>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {d.entries.length} mutatie{d.entries.length === 1 ? "" : "s"}
                  </span>
                  {canEdit && (
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
              <span className="min-w-[10%] whitespace-nowrap pr-1 text-right text-xs font-medium tabular-nums">
                <CurrencyText value={d.total} />
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="w-[12%] px-3 py-1 text-left font-medium">Datum</th>
                  <th className="w-[22%] px-3 py-1 text-left font-medium">Tegenpartij</th>
                  <th className="w-[13%] px-3 py-1 text-left font-medium">Factuurnr</th>
                  <th className="w-[16%] px-3 py-1 text-left font-medium">Categorie</th>
                  <th className="w-[16%] px-3 py-1 text-left font-medium">Begrotingspost</th>
                  <th className="w-[11%] px-3 py-1 text-right font-medium">Bedrag</th>
                  <th className="w-[6%] px-2 py-1 text-left font-medium">Factuur</th>
                  {canEdit && <th className="w-[4%] px-1 py-1" />}
                </tr>
              </thead>
              <tbody>
                {d.entries.map((e) => (
                  <tr
                    key={e.key}
                    className="group cursor-pointer border-b border-border/30 hover:bg-muted/20"
                    onClick={() => setOpenDossier(d.dossier)}
                  >
                    <td className="whitespace-nowrap px-3 py-1 tabular-nums">{formatDate(e.date)}</td>
                    <td className="px-3 py-1">{e.counterparty || e.description}</td>
                    <td className="px-3 py-1 tabular-nums">{e.invoice}</td>
                    <td className="px-3 py-1 text-muted-foreground">{e.categoryName}</td>
                    <td className="px-3 py-1 text-muted-foreground">{e.lineItemName || "Niet gekoppeld"}</td>
                    <td className={`px-3 py-1 text-right ${e.direction === "in" ? "text-green-600" : ""}`}>
                      <CurrencyCell value={e.direction === "in" ? e.amount : -e.amount} />
                    </td>
                    <td className="px-2 py-1 text-muted-foreground">
                      {docsByEntry.get(e.key) ? (
                        <span className="inline-flex items-center gap-0.5 text-brand-red">
                          <Paperclip className="h-3 w-3" />
                          {docsByEntry.get(e.key)}
                        </span>
                      ) : (
                        ""
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-1 py-1 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            applyDossier((e as any).sources || [e], null);
                          }}
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

      {activeRow && (
        <DossierDetailDialog
          open={!!openDossier}
          onOpenChange={(o) => !o && setOpenDossier(null)}
          dossier={activeRow.dossier}
          year={year}
          entries={activeRow.entries}
          documents={documents.filter(
            (doc) =>
              activeRow.entries.some((e) =>
                [e.key, ...(e.sources || []).map((s) => s.key)].includes(doc.entry_key),
              ) ||
              doc.entry_key === `dossier:${activeRow.dossier}` ||
              (!!doc.dossier && doc.dossier === activeRow.dossier),
          )}
          isAdmin={canEdit}
          onRemoveFromDossier={(entry) => applyDossier([entry], null)}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingDossier} onOpenChange={(open) => !open && setDeletingDossier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dossier verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je dossier "{deletingDossier?.dossier}" wilt verwijderen? De{" "}
              {deletingDossier?.entries.length} mutaties worden niet verwijderd, maar de dossierkoppeling wordt losgemaakt.
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Mutaties koppelen aan dossier</DialogTitle>
            <DialogDescription>Kies een bestaand dossier of maak een nieuwe aan, en selecteer de mutaties.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium">Dossier</label>
                {dossiers.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-brand-red hover:underline"
                    onClick={() => setDossierMode(dossierMode === "existing" ? "new" : "existing")}
                  >
                    {dossierMode === "existing" ? "+ Nieuw dossier aanmaken" : "← Kies bestaand dossier"}
                  </button>
                )}
              </div>
              {dossierMode === "existing" && dossiers.length > 0 ? (
                <Select value={existingDossier} onValueChange={setExistingDossier}>
                  <SelectTrigger>
                    <SelectValue placeholder="Kies een bestaand dossier…" />
                  </SelectTrigger>
                  <SelectContent>
                    {dossiers.map((d) => (
                      <SelectItem key={d.dossier} value={d.dossier}>
                        {d.dossier} <span className="text-xs text-muted-foreground">({d.entries.length})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={newDossierName}
                  onChange={(e) => setNewDossierName(e.target.value)}
                  placeholder="Bijv. Advocaatkosten 2025"
                  autoFocus
                />
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium">Mutaties zonder dossier ({unassigned.length})</label>
                {selectedIds.size > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.size} geselecteerd · <CurrencyText value={selectedTotal} />
                  </span>
                )}
              </div>
              <Input
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Zoek op tegenpartij, omschrijving, factuurnr, categorie…"
                className="mb-2 h-8 text-sm"
              />
              <ScrollArea className="h-[300px] rounded-md border border-border">
                {unassigned.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">
                    {searchFilter ? "Geen resultaten" : "Alle mutaties zijn al aan een dossier gekoppeld"}
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 z-10 bg-background">
                      <tr className="border-b border-border/50">
                        <th className="w-8 px-2 py-1.5" />
                        <th className="px-2 py-1.5 text-left font-medium">Datum</th>
                        <th className="px-2 py-1.5 text-left font-medium">Tegenpartij</th>
                        <th className="px-2 py-1.5 text-left font-medium">Factuurnr</th>
                        <th className="px-2 py-1.5 text-left font-medium">Categorie</th>
                        <th className="px-2 py-1.5 text-right font-medium">Bedrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unassigned.map((e) => (
                        <tr
                          key={e.key}
                          className="cursor-pointer border-b border-border/30 hover:bg-muted/20"
                          onClick={() => toggleEntry(e.key)}
                        >
                          <td className="px-2 py-1">
                            <Checkbox checked={selectedIds.has(e.key)} onCheckedChange={() => toggleEntry(e.key)} />
                          </td>
                          <td className="whitespace-nowrap px-2 py-1 tabular-nums">{formatDate(e.date)}</td>
                          <td className="px-2 py-1">{e.counterparty || e.description}</td>
                          <td className="px-2 py-1 tabular-nums">{e.invoice}</td>
                          <td className="px-2 py-1 text-muted-foreground">{e.categoryName || "—"}</td>
                          <td className={`px-2 py-1 text-right tabular-nums ${e.direction === "in" ? "text-green-600" : ""}`}>
                            <CurrencyCell value={e.direction === "in" ? e.amount : -e.amount} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Annuleren
            </Button>
            <Button
              onClick={createDossier}
              disabled={
                (dossierMode === "new" ? !newDossierName.trim() : !existingDossier.trim()) || selectedIds.size === 0
              }
            >
              {dossierMode === "new" ? "Dossier aanmaken" : "Koppelen"} ({selectedIds.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
