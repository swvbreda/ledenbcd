import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, Loader2, Check, ArrowDownToLine, ArrowUpFromLine, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import type { BudgetCategory } from "@/hooks/useBudget";
import type { Contribution } from "@/hooks/useContributions";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";

interface ExtractedEntry {
  expense_date?: string;
  direction: "in" | "out";
  category?: string;
  line_item?: string;
  dossier?: string;
  creditor_name: string;
  invoice_reference?: string;
  amount: number;
  selected: boolean;
  assigned_line_item_id?: string;
  assigned_member_id?: number;
  wrong_year?: boolean;
  already_present?: boolean;
  existing_description?: string;
}

interface MemberOption { id: number; naam: string }

const LINK_MEMORY_KEY = "bcd-pdf-member-link-memory-v1";

const loadLinkMemory = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(LINK_MEMORY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveLinkMemory = (memory: Record<string, number>) => {
  try {
    localStorage.setItem(LINK_MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // ignore
  }
};

interface MemberComboboxProps {
  value: number | undefined;
  onChange: (id: number | undefined) => void;
  members: MemberOption[];
  disabled?: boolean;
}

function MemberCombobox({ value, onChange, members, disabled }: MemberComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? members.find((m) => m.id === value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-6 w-full items-center justify-between rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
        >
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected ? `#${selected.id} — ${selected.naam}` : "Koppel aan lid..."}
          </span>
          <span className="flex items-center gap-1">
            {selected && (
              <X
                size={12}
                className="text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(undefined);
                }}
              />
            )}
            <ChevronsUpDown size={12} className="text-muted-foreground" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <Command
          filter={(val, search) => {
            return val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Zoek lid..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>Geen lid gevonden.</CommandEmpty>
            <CommandGroup>
              {members.map((m) => (
                <CommandItem
                  key={m.id}
                  value={`#${m.id} ${m.naam}`}
                  onSelect={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className="text-xs"
                >
                  #{m.id} — {m.naam}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: BudgetCategory[];
  members: MemberOption[];
  contributions?: Contribution[];
  onImport: (expenses: { line_item_id: string; description?: string; amount: number; expense_date?: string; creditor_name?: string; invoice_reference?: string; dossier?: string; created_by: string; paid?: boolean; paid_date?: string | null }[]) => Promise<void>;
  onImportIncome: (incomes: { member_id: number; amount: number; paid_date: string }[]) => Promise<void>;
  userId: string;
  year: number;
}

export default function PdfImportDialog({ open, onOpenChange, categories, members, contributions = [], onImport, onImportIncome, userId, year }: Props) {
  const [step, setStep] = useState<"upload" | "review" | "importing">("upload");
  const [entries, setEntries] = useState<ExtractedEntry[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [defaultLineItemId, setDefaultLineItemId] = useState<string>("");
  const [markAsPaid, setMarkAsPaid] = useState(true);
  const [hideExisting, setHideExisting] = useState(false);
  const [matchTolerance, setMatchTolerance] = useState(0.01);

  const allLineItems = categories.flatMap((c) =>
    c.line_items.map((li) => ({ id: li.id, label: `${c.name} → ${li.name}` }))
  );

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => (a.naam || "").localeCompare(b.naam || "")),
    [members]
  );

  const normaliseName = (s: string) =>
    s.toLowerCase().replace(/\b(b\.?v\.?|v\.?o\.?f\.?|holding|coffeeshop|stichting)\b/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

  // Dashboard rows for matching (signed: + income, - expense)
  const dashboardRows = useMemo(() => {
    const rows: { date: string; amount: number; description: string; creditorKey: string }[] = [];
    for (const cat of categories) {
      for (const li of cat.line_items) {
        for (const exp of li.expenses) {
          const d = exp.paid_date || exp.expense_date;
          if (!d) continue;
          rows.push({
            date: d,
            amount: -Math.abs(exp.amount),
            description: [exp.creditor_name, `${cat.name} → ${li.name}`].filter(Boolean).join(" — "),
            creditorKey: normaliseName(exp.creditor_name || exp.description || ""),
          });
        }
      }
    }
    for (const c of contributions) {
      if (!c.paid) continue;
      const d = c.paid_date || c.invoice_date;
      if (!d) continue;
      const memberName = members.find((m) => m.id === c.member_id)?.naam || `Lid #${c.member_id}`;
      rows.push({
        date: d,
        amount: Math.abs(c.amount),
        description: `Contributie — ${memberName}`,
        creditorKey: normaliseName(memberName),
      });
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, contributions, members]);

  const findExistingMatch = (
    entry: { expense_date?: string; direction: "in" | "out"; amount: number },
    usedKeys: Set<string>,
    tolerance: number,
    creditorKey?: string
  ) => {
    if (!entry.expense_date) return null;
    const signed = entry.direction === "in" ? Math.abs(entry.amount) : -Math.abs(entry.amount);
    // First pass: strict match including creditor key (when both sides have one)
    if (creditorKey) {
      for (let i = 0; i < dashboardRows.length; i++) {
        const d = dashboardRows[i];
        const key = `${i}`;
        if (usedKeys.has(key)) continue;
        if (
          d.date === entry.expense_date &&
          Math.abs(d.amount - signed) <= tolerance + 1e-9 &&
          d.creditorKey &&
          (d.creditorKey === creditorKey ||
            (creditorKey.length >= 4 &&
              (d.creditorKey.includes(creditorKey) || creditorKey.includes(d.creditorKey))))
        ) {
          usedKeys.add(key);
          return d;
        }
      }
    }
    // Fallback: when no creditor on either side, allow date+amount match only if creditor info missing
    for (let i = 0; i < dashboardRows.length; i++) {
      const d = dashboardRows[i];
      const key = `${i}`;
      if (usedKeys.has(key)) continue;
      if (
        d.date === entry.expense_date &&
        Math.abs(d.amount - signed) <= tolerance + 1e-9 &&
        (!creditorKey || !d.creditorKey)
      ) {
        usedKeys.add(key);
        return d;
      }
    }
    return null;
  };

  const applyDuplicateDetection = (list: ExtractedEntry[], tolerance: number) => {
    const usedKeys = new Set<string>();
    return list.map((e) => {
      const ck = normaliseName(e.creditor_name || "");
      const match = findExistingMatch(e, usedKeys, tolerance, ck || undefined);
      if (match) {
        return { ...e, already_present: true, existing_description: match.description };
      }
      return { ...e, already_present: false, existing_description: undefined };
    });
  };

  const normaliseName = (s: string) =>
    s.toLowerCase().replace(/\b(b\.?v\.?|v\.?o\.?f\.?|holding|coffeeshop|stichting)\b/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

  const matchMember = (name: string): number | undefined => {
    if (!name) return undefined;
    const n = normaliseName(name);
    if (!n) return undefined;
    // 1) previous user corrections (highest priority)
    const memory = loadLinkMemory();
    if (memory[n] && sortedMembers.find((mm) => mm.id === memory[n])) {
      return memory[n];
    }
    // exact normalised match
    let m = sortedMembers.find((mm) => normaliseName(mm.naam) === n);
    if (m) return m.id;
    // substring either way (min 4 chars)
    if (n.length >= 4) {
      m = sortedMembers.find((mm) => {
        const mn = normaliseName(mm.naam);
        return mn.length >= 4 && (mn.includes(n) || n.includes(mn));
      });
      if (m) return m.id;
    }
    return undefined;
  };

  // Recompute duplicates when tolerance changes
  useEffect(() => {
    if (entries.length > 0) {
      setEntries((prev) => applyDuplicateDetection(prev, matchTolerance));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchTolerance]);

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
        toast.warning("Geen regels gevonden in de PDF");
        return;
      }

      // Try to auto-match line items / members
      const enriched: ExtractedEntry[] = data.entries.map((entry: any) => {
        const direction: "in" | "out" = entry.direction === "in" ? "in" : "out";
        let matchedId = entry.matched_line_item_id || "";
        if (matchedId && !allLineItems.find((li) => li.id === matchedId)) {
          matchedId = "";
        }
        if (direction === "out" && !matchedId && entry.line_item) {
          const match = allLineItems.find(
            (li) => li.label.toLowerCase().includes(entry.line_item.toLowerCase()) ||
              entry.line_item.toLowerCase().includes(li.label.split(" → ")[1]?.toLowerCase() ?? "")
          );
          if (match) matchedId = match.id;
        }
        if (direction === "out" && !matchedId && entry.category) {
          const match = allLineItems.find(
            (li) => li.label.toLowerCase().includes(entry.category.toLowerCase())
          );
          if (match) matchedId = match.id;
        }
        const assignedMember = direction === "in" ? matchMember(entry.creditor_name || "") : undefined;
        // Year validation: check if expense_date belongs to the selected year
        const entryYear = entry.expense_date ? new Date(entry.expense_date).getFullYear() : null;
        const wrongYear = entryYear !== null && entryYear !== year;
        return {
          ...entry,
          direction,
          selected: !wrongYear,
          assigned_line_item_id: matchedId,
          assigned_member_id: assignedMember,
          wrong_year: wrongYear,
        };
      });

      // Detect duplicates against the dashboard (date + amount + direction)
      const detected = applyDuplicateDetection(enriched, matchTolerance);
      for (const e of detected) {
        if (e.already_present) e.selected = false;
      }
      enriched.splice(0, enriched.length, ...detected);

      const wrongYearCount = enriched.filter(e => e.wrong_year).length;
      if (wrongYearCount > 0) {
        toast.warning(`${wrongYearCount} regels uit een ander jaar dan ${year} (automatisch uitgevinkt)`);
      }
      const dupCount = enriched.filter(e => e.already_present).length;
      if (dupCount > 0) {
        toast.info(`${dupCount} regels staan al in het dashboard (automatisch uitgevinkt)`);
      }
      const inCount = enriched.filter((e) => e.direction === "in").length;
      const outCount = enriched.length - inCount;

      setEntries(enriched);
      setStep("review");
      toast.success(`${data.count} regels geëxtraheerd (${inCount} bij, ${outCount} af)`);
    } catch (err: any) {
      toast.error(err.message || "Fout bij PDF-extractie");
    } finally {
      setExtracting(false);
    }
  };

  const toggleAll = (checked: boolean) => {
    setEntries((prev) => prev.map((e) => ({ ...e, selected: checked && !e.already_present })));
  };

  const toggleEntry = (idx: number) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, selected: !e.selected } : e)));
  };

  const setLineItem = (idx: number, lineItemId: string) => {
    setEntries((prev) => prev.map((e, i) => (i === idx ? { ...e, assigned_line_item_id: lineItemId } : e)));
  };

  const setMember = (idx: number, memberId: number | undefined) => {
    setEntries((prev) => {
      const target = prev[idx];
      if (target && memberId) {
        const key = normaliseName(target.creditor_name || "");
        if (key) {
          const memory = loadLinkMemory();
          memory[key] = memberId;
          saveLinkMemory(memory);
        }
      }
      return prev.map((e, i) => (i === idx ? { ...e, assigned_member_id: memberId } : e));
    });
  };

  const flipDirection = (idx: number) => {
    setEntries((prev) =>
      prev.map((e, i) =>
        i === idx
          ? {
              ...e,
              direction: e.direction === "in" ? "out" : "in",
              assigned_line_item_id: e.direction === "in" ? e.assigned_line_item_id : "",
              assigned_member_id: e.direction === "out" ? matchMember(e.creditor_name) : undefined,
            }
          : e
      )
    );
  };

  const applyDefaultToUnassigned = () => {
    if (!defaultLineItemId) return;
    setEntries((prev) =>
      prev.map((e) =>
        e.selected && e.direction === "out" && !e.assigned_line_item_id
          ? { ...e, assigned_line_item_id: defaultLineItemId }
          : e
      )
    );
  };

  const selectedEntries = entries.filter((e) => e.selected);
  const readyExpenses = selectedEntries.filter((e) => e.direction === "out" && e.assigned_line_item_id);
  const readyIncomes = selectedEntries.filter((e) => e.direction === "in" && e.assigned_member_id);
  const readyCount = readyExpenses.length + readyIncomes.length;
  const totalOut = selectedEntries.filter((e) => e.direction === "out").reduce((s, e) => s + e.amount, 0);
  const totalIn = selectedEntries.filter((e) => e.direction === "in").reduce((s, e) => s + e.amount, 0);

  const handleImport = async () => {
    if (readyCount === 0) {
      toast.error("Geen regels klaar voor import (wijs begrotingsposten of leden toe)");
      return;
    }
    setStep("importing");
    try {
      if (readyExpenses.length > 0) {
        await onImport(
          readyExpenses.map((e) => ({
            line_item_id: e.assigned_line_item_id!,
            description: e.creditor_name,
            amount: e.amount,
            expense_date: e.expense_date || undefined,
            creditor_name: e.creditor_name,
            invoice_reference: e.invoice_reference || undefined,
            dossier: e.dossier || undefined,
            created_by: userId,
            paid: markAsPaid,
            paid_date: markAsPaid ? (e.expense_date || new Date().toISOString().slice(0, 10)) : null,
          }))
        );
      }
      if (readyIncomes.length > 0) {
        await onImportIncome(
          readyIncomes.map((e) => ({
            member_id: e.assigned_member_id!,
            amount: e.amount,
            paid_date: e.expense_date || new Date().toISOString().slice(0, 10),
          }))
        );
      }
      toast.success(`${readyExpenses.length} uitgaven + ${readyIncomes.length} bijschrijvingen geïmporteerd`);
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
            {step === "upload" ? `Bank- of crediteuren-PDF importeren (${year})` : `Geëxtraheerde regels (${year})`}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Upload een bankafschrift of crediteurenlijst (PDF). De AI extraheert alle regels en bepaalt per regel of het een bijschrijving (inkomst) of afschrijving (uitgave) is. Bijschrijvingen worden gekoppeld aan een lid en geboekt als contributiebetaling.
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
              <span className="text-xs text-muted-foreground">Standaardpost voor niet-toegewezen uitgaven:</span>
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
              <label className="flex items-center gap-1.5 text-xs ml-2 cursor-pointer">
                <Checkbox
                  checked={markAsPaid}
                  onCheckedChange={(c) => setMarkAsPaid(!!c)}
                />
                <span>Uitgaven al betaald — boekdatum = betaaldatum</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <Checkbox
                  checked={hideExisting}
                  onCheckedChange={(c) => setHideExisting(!!c)}
                />
                <span>Verberg al-aanwezige regels</span>
              </label>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Tolerantie (€):</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={matchTolerance}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setMatchTolerance(Number.isFinite(val) ? Math.max(0, Math.min(1, val)) : 0.01);
                  }}
                  className="h-7 w-20 text-xs"
                />
              </div>
              <span className="ml-auto text-xs text-muted-foreground">
                {readyCount}/{selectedEntries.length} klaar • <span className="text-green-600">+<CurrencyText value={totalIn} /></span> / <span className="text-destructive">−<CurrencyText value={totalOut} /></span>
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
                    <th className="px-2 py-1.5 text-left font-medium w-[60px]">Type</th>
                    <th className="px-2 py-1.5 text-left font-medium">Datum</th>
                    <th className="px-2 py-1.5 text-left font-medium">Tegenpartij</th>
                    <th className="px-2 py-1.5 text-left font-medium">Dossier</th>
                    <th className="px-2 py-1.5 text-left font-medium">Factuurnr</th>
                    <th className="px-2 py-1.5 text-right font-medium">Bedrag</th>
                    <th className="px-2 py-1.5 text-left font-medium w-[110px]">Status</th>
                    <th className="px-2 py-1.5 text-left font-medium min-w-[220px]">Begrotingspost / Lid</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => {
                    if (hideExisting && entry.already_present) return null;
                    const rowBg = entry.already_present
                      ? "bg-green-500/5"
                      : entry.wrong_year
                        ? "bg-destructive/5"
                        : "bg-amber-500/5";
                    return (
                    <tr key={idx} className={`border-b border-border/50 ${entry.selected ? "" : "opacity-50"} ${rowBg}`}>
                      <td className="px-2 py-1">
                        <Checkbox checked={entry.selected} onCheckedChange={() => toggleEntry(idx)} />
                      </td>
                      <td className="px-2 py-1">
                        <button
                          type="button"
                          onClick={() => flipDirection(idx)}
                          title="Klik om om te keren tussen Bij en Af"
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                            entry.direction === "in"
                              ? "bg-green-600/10 text-green-700 border-green-600/40"
                              : "bg-destructive/10 text-destructive border-destructive/40"
                          }`}
                        >
                          {entry.direction === "in" ? <ArrowDownToLine size={10} /> : <ArrowUpFromLine size={10} />}
                          {entry.direction === "in" ? "Bij" : "Af"}
                        </button>
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap tabular-nums">
                        {entry.expense_date || ""}
                        {entry.wrong_year && (
                          <span className="ml-1 text-[10px] text-destructive font-medium">≠{year}</span>
                        )}
                      </td>
                      <td className="px-2 py-1">{entry.creditor_name}</td>
                      <td className="px-2 py-1">{entry.dossier || ""}</td>
                      <td className="px-2 py-1 tabular-nums">{entry.invoice_reference || ""}</td>
                      <td className={`px-2 py-1 text-right tabular-nums ${entry.direction === "in" ? "text-green-600" : ""}`}>
                        {entry.direction === "in" ? "+" : "−"}
                        <CurrencyCell value={entry.amount} />
                      </td>
                      <td className="px-2 py-1">
                        {entry.already_present ? (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-green-600/15 text-green-700 border-green-600/40"
                            title={entry.existing_description || "Komt overeen met een bestaande dashboardregel"}
                          >
                            <Check size={10} /> Al aanwezig
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border bg-amber-500/15 text-amber-700 border-amber-500/40">
                            Nieuw
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {entry.direction === "out" ? (
                          <Select
                            value={entry.assigned_line_item_id || ""}
                            onValueChange={(v) => setLineItem(idx, v)}
                            disabled={!entry.selected}
                          >
                            <SelectTrigger className="h-6 text-xs">
                              <SelectValue placeholder="Toewijzen aan begrotingspost..." />
                            </SelectTrigger>
                            <SelectContent>
                              {allLineItems.map((li) => (
                                <SelectItem key={li.id} value={li.id} className="text-xs">{li.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <MemberCombobox
                            value={entry.assigned_member_id}
                            onChange={(id) => setMember(idx, id)}
                            members={sortedMembers}
                            disabled={!entry.selected}
                          />
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setStep("upload"); setEntries([]); }}>
                Andere PDF
              </Button>
              <Button size="sm" onClick={handleImport} disabled={readyCount === 0}>
                <Check size={14} className="mr-1" />
                {readyCount} regels importeren
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
