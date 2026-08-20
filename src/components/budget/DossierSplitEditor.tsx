import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDossierSplitActions, useDossierSplits } from "@/hooks/useDossiers";

interface Props {
  /** "expense:<id>" | "bank:<id>" | "ponto:<id>" */
  entryKey: string;
  totalAmount: number;
  year: number;
  dossierOptions: string[];
}

type Row = { dossier: string; amount: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function DossierSplitEditor({ entryKey, totalAmount, year, dossierOptions }: Props) {
  const { data: allSplits = [] } = useDossierSplits();
  const { save } = useDossierSplitActions();
  const existing = useMemo(
    () => allSplits.filter((s) => s.entry_key === entryKey),
    [allSplits, entryKey],
  );
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    setRows(existing.map((s) => ({ dossier: s.dossier, amount: String(s.amount) })));
  }, [entryKey, existing.length]);

  const total = round2(Math.abs(totalAmount));
  const assigned = round2(rows.reduce((s, r) => s + (parseFloat(r.amount.replace(",", ".")) || 0), 0));
  const remaining = round2(total - assigned);
  const valid = rows.length === 0 || (Math.abs(remaining) < 0.01 && rows.every((r) => r.dossier.trim()));

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { dossier: "", amount: prev.length === 0 ? String(total) : remaining > 0 ? String(remaining) : "" },
    ]);

  const handleSave = () => {
    save.mutate(
      {
        entryKey,
        year,
        splits: rows.map((r) => ({ dossier: r.dossier, amount: parseFloat(r.amount.replace(",", ".")) || 0 })),
      },
      {
        onSuccess: () => toast.success(rows.length === 0 ? "Verdeling verwijderd" : "Dossierverdeling opgeslagen"),
        onError: (e: any) => toast.error(e?.message || "Opslaan mislukt"),
      },
    );
  };

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground">
          Dossierverdeling (kosten splitsen over meerdere dossiers)
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          Totaal € {total.toLocaleString("nl-NL", { minimumFractionDigits: 2 })} · nog te verdelen{" "}
          <span className={Math.abs(remaining) < 0.01 ? "" : "font-medium text-destructive"}>
            € {remaining.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}
          </span>
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Geen verdeling — de boeking telt volledig mee in het gekozen dossier hierboven.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1">
                <Select value={r.dossier || undefined} onValueChange={(v) => setRow(i, { dossier: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Kies dossier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dossierOptions.map((d) => (
                      <SelectItem key={d} value={d} className="text-xs">
                        {d}
                      </SelectItem>
                    ))}
                    {r.dossier && !dossierOptions.includes(r.dossier) && (
                      <SelectItem value={r.dossier} className="text-xs">
                        {r.dossier}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Input
                value={r.amount}
                onChange={(ev) => setRow(i, { amount: ev.target.value })}
                inputMode="decimal"
                placeholder="0,00"
                className="h-8 w-28 text-right text-xs tabular-nums"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                title="Regel verwijderen"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={addRow}>
          <Plus className="mr-1 h-3 w-3" /> Dossier toevoegen
        </Button>
        <Button size="sm" className="h-8 text-xs" disabled={!valid || save.isPending} onClick={handleSave}>
          <Check className="mr-1 h-3 w-3" /> Verdeling opslaan
        </Button>
        {!valid && (
          <span className="text-[11px] text-destructive">De bedragen moeten samen het totaal zijn.</span>
        )}
      </div>
    </div>
  );
}