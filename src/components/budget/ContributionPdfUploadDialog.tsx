import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";

interface MemberOption {
  id: number;
  naam: string;
}

interface ExistingInvoice {
  invoice_number: string | null;
  member_id: number;
}

interface ExtractedEntry {
  debtor_name: string;
  invoice_number?: string;
  invoice_date?: string;
  amount: number;
  member_number?: number;
  matched_member_id?: number;
  selected: boolean;
  assigned_member_id?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  members: MemberOption[];
  year: number;
  existingInvoices?: ExistingInvoice[];
  onImport: (entries: { member_id: number; invoice_number?: string | null }[]) => Promise<void>;
}

export default function ContributionPdfUploadDialog({ open, onOpenChange, members, year, existingInvoices = [], onImport }: Props) {
  const [step, setStep] = useState<"upload" | "review" | "importing">("upload");
  const [entries, setEntries] = useState<ExtractedEntry[]>([]);
  const [extracting, setExtracting] = useState(false);

  const existingInvoiceNumbers = useMemo(() => {
    const set = new Set<string>();
    existingInvoices.forEach(inv => {
      if (inv.invoice_number) set.add(inv.invoice_number.trim().toLowerCase());
    });
    return set;
  }, [existingInvoices]);

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.naam.localeCompare(b.naam, "nl")),
    [members]
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Alleen PDF-bestanden zijn toegestaan");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Bestand is te groot (max 20MB)");
      return;
    }

    setExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("members", JSON.stringify(members.map(m => ({ id: m.id, naam: m.naam }))));

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-debtors`,
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
        toast.warning("Geen debiteurenregels gevonden in de PDF");
        return;
      }

      const enriched: ExtractedEntry[] = data.entries.map((entry: any) => {
        let matchedId = entry.matched_member_id ? String(entry.matched_member_id) : "";
        if (matchedId && !members.find(m => String(m.id) === matchedId)) {
          matchedId = "";
        }
        if (!matchedId && entry.member_number) {
          const match = members.find(m => m.id === entry.member_number);
          if (match) matchedId = String(match.id);
        }
        const isDuplicate = !!(entry.invoice_number && existingInvoiceNumbers.has(entry.invoice_number.trim().toLowerCase()));
        return { ...entry, selected: !isDuplicate, assigned_member_id: matchedId };
      });

      const dupeCount = enriched.filter(e => !e.selected && e.invoice_number && existingInvoiceNumbers.has(e.invoice_number.trim().toLowerCase())).length;
      if (dupeCount > 0) {
        toast.info(`${dupeCount} facturen al geïmporteerd (overgeslagen)`);
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
    setEntries(prev => prev.map(e => ({ ...e, selected: checked })));
  };

  const toggleEntry = (idx: number) => {
    setEntries(prev => prev.map((e, i) => (i === idx ? { ...e, selected: !e.selected } : e)));
  };

  const setMember = (idx: number, memberId: string) => {
    setEntries(prev => prev.map((e, i) => (i === idx ? { ...e, assigned_member_id: memberId } : e)));
  };

  const selectedEntries = entries.filter(e => e.selected);
  const readyEntries = selectedEntries.filter(e => e.assigned_member_id);
  const total = selectedEntries.reduce((s, e) => s + e.amount, 0);

  const handleImport = async () => {
    if (readyEntries.length === 0) {
      toast.error("Geen regels klaar voor import (wijs leden toe)");
      return;
    }
    setStep("importing");
    try {
      await onImport(
        readyEntries.map(e => ({
          member_id: Number(e.assigned_member_id),
          invoice_number: e.invoice_number || null,
        }))
      );
      toast.success(`${readyEntries.length} contributie-facturen geïmporteerd`);
      onOpenChange(false);
      setStep("upload");
      setEntries([]);
    } catch (err: any) {
      toast.error("Fout bij importeren: " + (err.message || "onbekend"));
      setStep("review");
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep("upload");
      setEntries([]);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} />
            {step === "upload" ? `Visionplanner PDF importeren (${year})` : "Geëxtraheerde debiteurenregels"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Upload een debiteurenlijst uit Visionplanner (PDF). De AI extraheert automatisch alle
              regels en koppelt ze aan leden.
            </p>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              {extracting ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-brand-red" size={32} />
                  <p className="text-sm text-muted-foreground">PDF wordt geanalyseerd door AI...</p>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-3">
                  <Upload size={32} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Klik om een PDF te uploaden</span>
                  <span className="text-xs text-muted-foreground">Max 20MB</span>
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="ml-auto text-xs text-muted-foreground">
                {readyEntries.length}/{selectedEntries.length} gekoppeld • <CurrencyText value={total} />
              </span>
            </div>

            <div className="flex-1 overflow-auto border border-border rounded-lg">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/50 backdrop-blur">
                  <tr className="border-b border-border">
                    <th className="px-2 py-1.5 w-8">
                      <Checkbox
                        checked={entries.every(e => e.selected)}
                        onCheckedChange={(c) => toggleAll(!!c)}
                      />
                    </th>
                    <th className="px-2 py-1.5 text-left font-medium">Debiteur</th>
                    <th className="px-2 py-1.5 text-left font-medium">Factuurnr</th>
                    <th className="px-2 py-1.5 text-left font-medium">Datum</th>
                    <th className="px-2 py-1.5 text-right font-medium">Bedrag</th>
                    <th className="px-2 py-1.5 text-left font-medium min-w-[200px]">Lid</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => (
                    <tr key={idx} className={`border-b border-border/50 ${entry.selected ? "" : "opacity-40"}`}>
                      <td className="px-2 py-1">
                        <Checkbox checked={entry.selected} onCheckedChange={() => toggleEntry(idx)} />
                      </td>
                      <td className="px-2 py-1">{entry.debtor_name}</td>
                      <td className="px-2 py-1 tabular-nums">
                        {entry.invoice_number || ""}
                        {entry.invoice_number && existingInvoiceNumbers.has(entry.invoice_number.trim().toLowerCase()) && (
                          <span className="ml-1 text-[10px] text-destructive font-medium">DUBBEL</span>
                        )}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap tabular-nums">{entry.invoice_date || ""}</td>
                      <td className="px-2 py-1 text-right"><CurrencyCell value={entry.amount} /></td>
                      <td className="px-2 py-1">
                        <Select
                          value={entry.assigned_member_id || ""}
                          onValueChange={(v) => setMember(idx, v)}
                          disabled={!entry.selected}
                        >
                          <SelectTrigger className="h-6 text-xs">
                            <SelectValue placeholder="Koppel lid..." />
                          </SelectTrigger>
                          <SelectContent>
                            {sortedMembers.map(m => (
                              <SelectItem key={m.id} value={String(m.id)} className="text-xs">
                                #{m.id} {m.naam}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setStep("upload"); setEntries([]); }}>
                Andere PDF
              </Button>
              <Button size="sm" onClick={handleImport} disabled={readyEntries.length === 0}>
                <Check size={14} className="mr-1" />
                {readyEntries.length} facturen importeren
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="animate-spin text-brand-red" size={32} />
            <p className="text-sm text-muted-foreground">Contributie-facturen worden geïmporteerd...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
