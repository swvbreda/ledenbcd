import { useState, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X } from "lucide-react";
import type { Contribution, ContributionInvoice } from "@/hooks/useContributions";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  year: number;
  contributions: Contribution[];
  invoices: ContributionInvoice[];
  members: { id: number; naam: string }[];
  onImport: (updates: { member_id: number; paid: boolean; paid_date: string | null }[]) => Promise<void>;
}

interface CsvRow {
  raw: Record<string, string>;
  matchedMemberId: number | null;
  matchedMemberName: string | null;
  matchedVia: "factuurnummer" | "lidnummer" | null;
  isPaid: boolean;
  paidDate: string | null;
}

type Step = "upload" | "map" | "preview" | "done";

export default function CsvImportDialog({ open, onOpenChange, year, contributions, invoices, members, onImport }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [colInvoice, setColInvoice] = useState("");
  const [colMemberId, setColMemberId] = useState("");
  const [colPaid, setColPaid] = useState("");
  const [colDate, setColDate] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ updated: number; skipped: number } | null>(null);

  const memberMap = useMemo(() => {
    const m = new Map<number, string>();
    members.forEach((mem) => m.set(mem.id, mem.naam));
    return m;
  }, [members]);

  const invoiceToMember = useMemo(() => {
    const m = new Map<string, number>();
    invoices.forEach((inv) => {
      if (inv.invoice_number) m.set(inv.invoice_number, inv.member_id);
    });
    return m;
  }, [invoices]);

  const resetState = useCallback(() => {
    setStep("upload");
    setHeaders([]);
    setRawRows([]);
    setColInvoice("");
    setColMemberId("");
    setColPaid("");
    setColDate("");
    setImportResult(null);
  }, []);

  const handleClose = (o: boolean) => {
    if (!o) resetState();
    onOpenChange(o);
  };

  const parseCsv = (text: string): { headers: string[]; rows: Record<string, string>[] } => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    // Detect delimiter
    const firstLine = lines[0];
    const delimiter = firstLine.includes(";") ? ";" : ",";

    const hdrs = firstLine.split(delimiter).map((h) => h.replace(/^["']|["']$/g, "").trim());
    const rows = lines.slice(1).map((line) => {
      const vals = line.split(delimiter).map((v) => v.replace(/^["']|["']$/g, "").trim());
      const row: Record<string, string> = {};
      hdrs.forEach((h, i) => { row[h] = vals[i] || ""; });
      return row;
    });

    return { headers: hdrs, rows };
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      toast.error("Alleen CSV-bestanden zijn toegestaan");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { headers: h, rows } = parseCsv(text);

      if (h.length === 0 || rows.length === 0) {
        toast.error("Geen geldige data gevonden in het bestand");
        return;
      }

      setHeaders(h);
      setRawRows(rows);

      // Auto-detect columns
      const lower = h.map((x) => x.toLowerCase());
      const invoiceCol = h[lower.findIndex((l) => l.includes("factuur") || l.includes("invoice"))] || "";
      const memberCol = h[lower.findIndex((l) => l.includes("lidnr") || l.includes("lid_id") || l.includes("member") || l.includes("debiteur"))] || "";
      const paidCol = h[lower.findIndex((l) => l.includes("betaald") || l.includes("paid") || l.includes("status") || l.includes("voldaan"))] || "";
      const dateCol = h[lower.findIndex((l) => l.includes("datum") || l.includes("date") || l.includes("betaaldatum"))] || "";

      setColInvoice(invoiceCol);
      setColMemberId(memberCol);
      setColPaid(paidCol);
      setColDate(dateCol);
      setStep("map");
    };
    reader.readAsText(file);
  };

  const mappedRows = useMemo((): CsvRow[] => {
    if (!colPaid && !colInvoice && !colMemberId) return [];

    return rawRows.map((raw) => {
      let matchedMemberId: number | null = null;
      let matchedVia: CsvRow["matchedVia"] = null;

      // Try invoice number first
      if (colInvoice && raw[colInvoice]) {
        const invoiceNr = raw[colInvoice].trim();
        const memberId = invoiceToMember.get(invoiceNr);
        if (memberId) {
          matchedMemberId = memberId;
          matchedVia = "factuurnummer";
        }
      }

      // Fallback to member ID
      if (!matchedMemberId && colMemberId && raw[colMemberId]) {
        const id = parseInt(raw[colMemberId].trim());
        if (!isNaN(id) && memberMap.has(id)) {
          matchedMemberId = id;
          matchedVia = "lidnummer";
        }
      }

      // Determine paid status
      let isPaid = false;
      if (colPaid && raw[colPaid]) {
        const val = raw[colPaid].toLowerCase().trim();
        isPaid = ["ja", "yes", "betaald", "voldaan", "1", "true", "paid"].includes(val);
      }

      // Parse date
      let paidDate: string | null = null;
      if (colDate && raw[colDate]) {
        const dateStr = raw[colDate].trim();
        // Try DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD
        const match = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (match) {
          paidDate = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
        } else {
          const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (isoMatch) paidDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
        }
      }

      if (isPaid && !paidDate) {
        paidDate = new Date().toISOString().split("T")[0];
      }

      return {
        raw,
        matchedMemberId,
        matchedMemberName: matchedMemberId ? memberMap.get(matchedMemberId) || null : null,
        matchedVia,
        isPaid,
        paidDate,
      };
    });
  }, [rawRows, colInvoice, colMemberId, colPaid, colDate, invoiceToMember, memberMap]);

  const matchedCount = mappedRows.filter((r) => r.matchedMemberId).length;
  const unmatchedCount = mappedRows.length - matchedCount;
  const paidCount = mappedRows.filter((r) => r.matchedMemberId && r.isPaid).length;

  const handleImport = async () => {
    const updates = mappedRows
      .filter((r) => r.matchedMemberId && r.isPaid)
      .map((r) => ({
        member_id: r.matchedMemberId!,
        paid: true,
        paid_date: r.paidDate,
      }));

    if (updates.length === 0) {
      toast.error("Geen betaalde rijen gevonden om te importeren");
      return;
    }

    setImporting(true);
    try {
      await onImport(updates);
      setImportResult({ updated: updates.length, skipped: unmatchedCount });
      setStep("done");
      toast.success(`${updates.length} betaalstatus(sen) bijgewerkt`);
    } catch (e: any) {
      toast.error("Import mislukt: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            CSV-import betaalstatussen ({year})
          </DialogTitle>
          <DialogDescription>
            Upload een debiteurenexport om betaalstatussen automatisch bij te werken
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 pt-2">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-3">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Sleep een CSV-bestand hierheen of klik om te selecteren</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Het bestand moet een kolom met factuurnummer of lidnummer bevatten,
                  en een kolom met de betaalstatus
                </p>
              </div>
              <label className="inline-block">
                <input type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                  <Upload className="h-4 w-4" /> Bestand kiezen
                </span>
              </label>
            </div>
            <div className="rounded-lg border border-border bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Verwacht formaat:</p>
              <p>• CSV met scheidingsteken <code>;</code> of <code>,</code></p>
              <p>• Kolom met factuurnummer (bijv. "Factuurnr") of lidnummer (bijv. "Lidnr")</p>
              <p>• Kolom met betaalstatus (bijv. "Betaald" → Ja/Nee)</p>
              <p>• Optioneel: kolom met betaaldatum (DD-MM-YYYY)</p>
            </div>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              {rawRows.length} rijen gevonden. Koppel de juiste kolommen:
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Factuurnummer</Label>
                <Select value={colInvoice} onValueChange={setColInvoice}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="— geen —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— geen —</SelectItem>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Lidnummer</Label>
                <Select value={colMemberId} onValueChange={setColMemberId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="— geen —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— geen —</SelectItem>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Betaalstatus *</Label>
                <Select value={colPaid} onValueChange={setColPaid}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecteer kolom" /></SelectTrigger>
                  <SelectContent>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Betaaldatum</Label>
                <Select value={colDate} onValueChange={setColDate}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="— geen —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— geen —</SelectItem>
                    {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(!colInvoice || colInvoice === "__none__") && (!colMemberId || colMemberId === "__none__") && (
              <p className="text-xs text-destructive">Selecteer minimaal een factuurnummer- of lidnummerkolom</p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("upload")} className="flex-1">Terug</Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={!colPaid || ((!colInvoice || colInvoice === "__none__") && (!colMemberId || colMemberId === "__none__"))}
                className="flex-1"
              >
                Voorbeeldweergave →
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4 pt-2">
            <div className="flex gap-3 text-sm">
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> {matchedCount} gekoppeld
              </Badge>
              {unmatchedCount > 0 && (
                <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                  <AlertTriangle className="h-3 w-3" /> {unmatchedCount} niet gevonden
                </Badge>
              )}
              <Badge variant="secondary">{paidCount} betaald</Badge>
            </div>

            <div className="border rounded-md max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Match</TableHead>
                    <TableHead>Lid</TableHead>
                    <TableHead className="w-28">Factuurnr</TableHead>
                    <TableHead className="w-20 text-center">Betaald</TableHead>
                    <TableHead className="w-28">Datum</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedRows.slice(0, 50).map((row, i) => (
                    <TableRow key={i} className={!row.matchedMemberId ? "opacity-50" : ""}>
                      <TableCell>
                        {row.matchedVia ? (
                          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                            {row.matchedVia === "factuurnummer" ? "Factuur" : "Lidnr"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                            <X className="h-3 w-3" />
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.matchedMemberName
                          ? `#${row.matchedMemberId} ${row.matchedMemberName}`
                          : colMemberId && row.raw[colMemberId]
                            ? `#${row.raw[colMemberId]} (niet gevonden)`
                            : colInvoice && row.raw[colInvoice]
                              ? `Factuur ${row.raw[colInvoice]} (niet gevonden)`
                              : "—"
                        }
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {colInvoice && colInvoice !== "__none__" ? row.raw[colInvoice] || "—" : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.isPaid ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                        ) : (
                          <span className="text-xs text-muted-foreground">Nee</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.paidDate || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {mappedRows.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  En nog {mappedRows.length - 50} meer...
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("map")} className="flex-1">Terug</Button>
              <Button
                onClick={handleImport}
                disabled={importing || paidCount === 0}
                className="flex-1"
              >
                {importing ? "Importeren..." : `${paidCount} betaalstatus(sen) importeren`}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && importResult && (
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h3 className="font-semibold text-lg">{importResult.updated} statussen bijgewerkt</h3>
            {importResult.skipped > 0 && (
              <p className="text-sm text-muted-foreground">
                {importResult.skipped} rijen overgeslagen (niet gevonden)
              </p>
            )}
            <Button onClick={() => handleClose(false)}>Sluiten</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}