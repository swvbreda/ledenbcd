import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, Loader2, Check, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import type { BudgetCategory } from "@/hooks/useBudget";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";

interface ExtractedEntry {
  expense_date?: string;
  category?: string;
  line_item?: string;
  dossier?: string;
  creditor_name: string;
  invoice_reference?: string;
  amount: number;
  selected: boolean;
  assigned_line_item_id?: string;
  wrong_year?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: BudgetCategory[];
  onImport: (expenses: { line_item_id: string; description?: string; amount: number; expense_date?: string; creditor_name?: string; invoice_reference?: string; dossier?: string; created_by: string }[]) => Promise<void>;
  userId: string;
  year: number;
}

export default function PdfImportDialog({ open, onOpenChange, categories, onImport, userId, year }: Props) {
  const [step, setStep] = useState<"upload" | "review" | "importing">("upload");
  const [entries, setEntries] = useState<ExtractedEntry[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [defaultLineItemId, setDefaultLineItemId] = useState<string>("");

  const allLineItems = categories.flatMap((c) =>
    c.line_items.map((li) => ({ id: li.id, label: `${c.name} → ${li.name}` }))
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Alleen PDF-bestanden zijn toegestaan");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Bestand is te groot (max 10MB)");
      return;
    }

    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("line_items", JSON.stringify(allLineItems));

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-creditors`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Onbekende fout" }));
        throw new Error(err.error || `Fout ${resp.status}`);
      }

      const data = await resp.json();
      if (!data.entries?.length) {
        toast.warning("Geen crediteurenregels gevonden in de PDF");
        return;
      }

      // Try to auto-match line items
      const enriched: ExtractedEntry[] = data.entries.map((entry: any) => {
        let matchedId = entry.matched_line_item_id || "";
        if (matchedId && !allLineItems.find((li) => li.id === matchedId)) {
          matchedId = "";
        }
        if (!matchedId && entry.line_item) {
          const match = allLineItems.find(
            (li) => li.label.toLowerCase().includes(entry.line_item.toLowerCase()) ||
              entry.line_item.toLowerCase().includes(li.label.split(" → ")[1]?.toLowerCase() ?? "")
          );
          if (match) matchedId = match.id;
        }
        if (!matchedId && entry.category) {
          const match = allLineItems.find(
            (li) => li.label.toLowerCase().includes(entry.category.toLowerCase())
          );
          if (match) matchedId = match.id;
        }
        // Year validation: check if expense_date belongs to the selected year
        const entryYear = entry.expense_date ? new Date(entry.expense_date).getFullYear() : null;
        const wrongYear = entryYear !== null && entryYear !== year;
        return { ...entry, selected: !wrongYear, assigned_line_item_id: matchedId, wrong_year: wrongYear };
      });

      const wrongYearCount = enriched.filter(e => e.wrong_year).length;
      if (wrongYearCount > 0) {
        toast.warning(`${wrongYearCount} regels uit een ander jaar dan ${year} (automatisch uitgevinkt)`);
      }

      setEntries(enriched);
      setStep("review");
      toast.success(`${data.count} regels geëxtraheerd`);
    } catch (err: any) {
      toast.error(err.message || "Fout bij PDF-extractie");
    } finally {
      setExtracting(false);
    }
  };

  const toggleAll = (checked: boolean) => {
    setEntries((prev) => prev.map((e) => ({ ...e, selected: checked })));
  };

  const toggleEntry = (idx: number) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, selected: !e.selected } : e)));
  };

  const setLineItem = (idx: number, lineItemId: string) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, assigned_line_item_id: lineItemId } : e)));
  };

  const applyDefaultToUnassigned = () => {
    if (!defaultLineItemId) return;
    setEntries((prev) =>
      prev.map((e) =>
        e.selected && !e.assigned_line_item_id ? { ...e, assigned_line_item_id: defaultLineItemId } : e
      )
    );
  };

  const selectedEntries = entries.filter((e) => e.selected);
  const readyEntries = selectedEntries.filter((e) => e.assigned_line_item_id);
  const total = selectedEntries.reduce((s, e) => s + e.amount, 0);

  const handleImport = async () => {
    if (readyEntries.length === 0) {
      toast.error("Geen regels klaar voor import (wijs begrotingsposten toe)");
      return;
    }
    setStep("importing");
    try {
      await onImport(
        readyEntries.map((e) => ({
          line_item_id: e.assigned_line_item_id!,
          description: e.creditor_name,
          amount: e.amount,
          expense_date: e.expense_date || undefined,
          creditor_name: e.creditor_name,
          invoice_reference: e.invoice_reference || undefined,
          dossier: e.dossier || undefined,
          created_by: userId,
        }))
      );
      toast.success(`${readyEntries.length} uitgaven geïmporteerd`);
      onOpenChange(false);
      setStep("upload");
      setEntries([]);
    } catch (err: any) {
      toast.error("Fout bij importeren: " + (err.message || "onbekend"));
      setStep("review");
    }
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setStep("upload");
      setEntries([]);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} />
            {step === "upload" ? "Visionplanner PDF importeren" : "Geëxtraheerde crediteurenregels"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Upload een crediteurenlijst uit Visionplanner (PDF). De AI extraheert automatisch alle
              regels zodat je ze kunt toewijzen aan begrotingsposten.
            </p>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              {extracting ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-primary" size={32} />
                  <p className="text-sm text-muted-foreground">PDF wordt geanalyseerd door AI...</p>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-3">
                  <Upload size={32} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Klik om een PDF te uploaden</span>
                  <span className="text-xs text-muted-foreground">Max 10MB</span>
                  <Input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              )}
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            {/* Bulk assign */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Standaardpost voor niet-toegewezen:</span>
              <Select value={defaultLineItemId} onValueChange={setDefaultLineItemId}>
                <SelectTrigger className="h-7 text-xs w-[250px]">
                  <SelectValue placeholder="Kies begrotingspost..." />
                </SelectTrigger>
                <SelectContent>
                  {allLineItems.map((li) => (
                    <SelectItem key={li.id} value={li.id} className="text-xs">{li.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={applyDefaultToUnassigned}>
                Toepassen
              </Button>
              <span className="ml-auto text-xs text-muted-foreground">
                {readyEntries.length}/{selectedEntries.length} klaar • <CurrencyText value={total} />
              </span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto border border-border rounded-lg">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/50 backdrop-blur">
                  <tr className="border-b border-border">
                    <th className="px-2 py-1.5 w-8">
                      <Checkbox
                        checked={entries.every((e) => e.selected)}
                        onCheckedChange={(c) => toggleAll(!!c)}
                      />
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium">Datum</th>
                    <th className="px-2 py-1.5 text-left font-medium">Leverancier</th>
                    <th className="px-2 py-1.5 text-left font-medium">Dossier</th>
                    <th className="px-2 py-1.5 text-left font-medium">Factuurnr</th>
                    <th className="px-2 py-1.5 text-right font-medium">Bedrag</th>
                    <th className="px-2 py-1.5 text-left font-medium min-w-[200px]">Begrotingspost</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => (
                    <tr key={idx} className={`border-b border-border/50 ${entry.selected ? "" : "opacity-40"} ${entry.wrong_year ? "bg-destructive/5" : ""}`}>
                      <td className="px-2 py-1">
                        <Checkbox checked={entry.selected} onCheckedChange={() => toggleEntry(idx)} />
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap tabular-nums">
                        {entry.expense_date || "–"}
                        {entry.wrong_year && (
                          <span className="ml-1 text-[10px] text-destructive font-medium">≠{year}</span>
                        )}
                      </td>
                      <td className="px-2 py-1">{entry.creditor_name}</td>
                      <td className="px-2 py-1">{entry.dossier || "–"}</td>
                      <td className="px-2 py-1 tabular-nums">{entry.invoice_reference || "–"}</td>
                      <td className="px-2 py-1 text-right"><CurrencyCell value={entry.amount} /></td>
                      <td className="px-2 py-1">
                        <Select
                          value={entry.assigned_line_item_id || ""}
                          onValueChange={(v) => setLineItem(idx, v)}
                          disabled={!entry.selected}
                        >
                          <SelectTrigger className="h-6 text-xs">
                            <SelectValue placeholder="Toewijzen..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allLineItems.map((li) => (
                              <SelectItem key={li.id} value={li.id} className="text-xs">{li.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setStep("upload"); setEntries([]); }}>
                Andere PDF
              </Button>
              <Button size="sm" onClick={handleImport} disabled={readyEntries.length === 0}>
                <Check size={14} className="mr-1" />
                {readyEntries.length} regels importeren
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="animate-spin text-primary" size={32} />
            <p className="text-sm text-muted-foreground">Uitgaven worden geïmporteerd...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
