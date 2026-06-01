import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { BudgetCategory } from "@/hooks/useBudget";
import { CurrencyCell } from "@/components/budget/CurrencyAmount";

interface ExpenseRow {
  id: string;
  date: string | null;
  amount: number;
  creditor: string;
  description: string;
  category: string;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: BudgetCategory[];
  onDeleteExpense: (id: string) => Promise<void> | void;
}

const normalise = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/\b(b\.?v\.?|v\.?o\.?f\.?|holding|coffeeshop|stichting)\b/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export default function DuplicatesDialog({ open, onOpenChange, categories, onDeleteExpense }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const rows: ExpenseRow[] = useMemo(() => {
    const out: ExpenseRow[] = [];
    for (const cat of categories) {
      for (const li of cat.line_items) {
        for (const exp of li.expenses) {
          out.push({
            id: exp.id,
            date: exp.paid_date || exp.expense_date || null,
            amount: Math.abs(exp.amount),
            creditor: exp.creditor_name || exp.description || "",
            description: exp.description || exp.creditor_name || "",
            category: `${cat.name} → ${li.name}`,
            created_at: exp.created_at,
          });
        }
      }
    }
    return out;
  }, [categories]);

  const groups = useMemo(() => {
    const map = new Map<string, ExpenseRow[]>();
    for (const r of rows) {
      if (!r.date) continue;
      const key = `${r.date}|${r.amount.toFixed(2)}|${normalise(r.creditor)}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    const dups: { key: string; items: ExpenseRow[] }[] = [];
    for (const [key, items] of map) {
      if (items.length > 1) {
        // newest first
        items.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
        dups.push({ key, items });
      }
    }
    return dups;
  }, [rows]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const autoSelect = () => {
    const next = new Set<string>();
    for (const g of groups) {
      // keep newest (index 0), select the rest
      for (let i = 1; i < g.items.length; i++) next.add(g.items[i].id);
    }
    setSelected(next);
    toast.info(`${next.size} dubbele regels aangevinkt (nieuwste blijft staan)`);
  };

  const clearSelection = () => setSelected(new Set());

  const handleDelete = async () => {
    if (selected.size === 0) {
      toast.error("Geen regels geselecteerd");
      return;
    }
    if (!confirm(`Weet je zeker dat je ${selected.size} regels wilt verwijderen?`)) return;
    setBusy(true);
    try {
      for (const id of selected) {
        await onDeleteExpense(id);
      }
      toast.success(`${selected.size} regels verwijderd`);
      setSelected(new Set());
    } catch (err: any) {
      toast.error("Fout bij verwijderen: " + (err.message || "onbekend"));
    } finally {
      setBusy(false);
    }
  };

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("nl-NL");
    } catch {
      return d;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            Dubbele uitgaven opruimen
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 py-2 border-b">
          <div className="text-sm text-muted-foreground">
            {groups.length === 0
              ? "Geen duplicaten gevonden."
              : `${groups.length} dubbele groep${groups.length === 1 ? "" : "en"} gevonden (matching op datum + bedrag + crediteur).`}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={autoSelect} disabled={groups.length === 0}>
              <Wand2 size={14} className="mr-1" /> Auto-ontdubbel (nieuwste blijft)
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection} disabled={selected.size === 0}>
              Selectie wissen
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2 space-y-4">
          {groups.map((g) => (
            <div key={g.key} className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/50 px-3 py-1.5 text-xs font-medium flex items-center justify-between">
                <span>
                  {fmtDate(g.items[0].date)} — <CurrencyCell value={g.items[0].amount} /> — {g.items[0].creditor || "(geen crediteur)"}
                </span>
                <span className="text-muted-foreground">{g.items.length}× aanwezig</span>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-background border-b">
                  <tr className="text-left text-muted-foreground">
                    <th className="w-8 px-2 py-1.5"></th>
                    <th className="px-2 py-1.5">Aangemaakt</th>
                    <th className="px-2 py-1.5">Omschrijving</th>
                    <th className="px-2 py-1.5">Categorie</th>
                  </tr>
                </thead>
                <tbody>
                  {g.items.map((it, idx) => (
                    <tr key={it.id} className={`border-t ${idx === 0 ? "bg-green-50/50" : ""}`}>
                      <td className="px-2 py-1.5">
                        <Checkbox
                          checked={selected.has(it.id)}
                          onCheckedChange={() => toggle(it.id)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        {it.created_at ? new Date(it.created_at).toLocaleString("nl-NL") : "—"}
                        {idx === 0 && <span className="ml-2 text-green-600 font-medium">(nieuwste)</span>}
                      </td>
                      <td className="px-2 py-1.5">{it.description}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{it.category}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <DialogFooter className="border-t pt-3">
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-muted-foreground">{selected.size} regels geselecteerd</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Sluiten</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={busy || selected.size === 0}>
                <Trash2 size={14} className="mr-1" />
                {busy ? "Verwijderen..." : `Verwijder ${selected.size}`}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}