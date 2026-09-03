import { useState, useMemo } from "react";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { normalizePhone } from "@/lib/phoneMatch";
import { toast } from "sonner";

type CsvRow = {
  display_name: string;
  phone: string | null;
  member_id: number | null;
  note: string | null;
};

type ExistingMap = Map<string, string>; // canonical phone -> id

interface CommunityUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const HEADER_ALIASES: Record<string, string[]> = {
  display_name: ["display_name", "naam", "name"],
  phone: ["phone", "telefoon", "telefoonnummer", "mobiel", "nummer"],
  member_id: ["member_id", "lidnummer", "lid id", "lid_id", "lid-id"],
  note: ["note", "notitie", "opmerking"],
};

function detectDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) || []).length;
  const semicolons = (headerLine.match(/;/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values.map((v) => v.replace(/^"+|"+$/g, ""));
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return { headers: [], rows: [] };
  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.toLowerCase().trim());
  const rows = lines.slice(1).map((line) => parseCsvLine(line, delimiter));
  return { headers, rows };
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

function cleanValue(value: string): string | null {
  const v = value.trim();
  if (!v || v === "-" || v === "NULL") return null;
  return v;
}

export default function CommunityUploadDialog({
  open,
  onOpenChange,
  onSuccess,
}: CommunityUploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<CsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [existingPhones, setExistingPhones] = useState<ExistingMap>(new Map());

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setParseError(null);
    setIsParsing(false);
    setIsImporting(false);
    setExistingPhones(new Map());
  };

  const handleOpenChange = (value: boolean) => {
    if (!value) reset();
    onOpenChange(value);
  };

  const loadExistingPhones = async (): Promise<ExistingMap> => {
    const { data, error } = await supabase
      .from("whatsapp_participants")
      .select("id, phone");
    if (error) throw error;
    const map = new Map<string, string>();
    for (const row of data ?? []) {
      const canonical = normalizePhone(row.phone);
      if (canonical && !map.has(canonical)) {
        map.set(canonical, row.id);
      }
    }
    return map;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setParsedRows([]);
    setParseError(null);
    if (!selected) return;

    setIsParsing(true);
    try {
      const text = await selected.text();
      const { headers, rows } = parseCsv(text);

      const nameIdx = findColumnIndex(headers, HEADER_ALIASES.display_name);
      const phoneIdx = findColumnIndex(headers, HEADER_ALIASES.phone);
      const memberIdx = findColumnIndex(headers, HEADER_ALIASES.member_id);
      const noteIdx = findColumnIndex(headers, HEADER_ALIASES.note);

      if (nameIdx < 0) {
        throw new Error("Geen 'Naam'-kolom gevonden. Verwachte kolommen: Naam, Telefoon, Lidnummer, Notitie.");
      }

      const existing = await loadExistingPhones();
      setExistingPhones(existing);

      const parsed: CsvRow[] = [];
      for (const row of rows) {
        const name = cleanValue(row[nameIdx] ?? "");
        if (!name) continue;
        const rawPhone = cleanValue(row[phoneIdx] ?? "");
        const phone = rawPhone ? rawPhone : null;
        const rawMember = cleanValue(row[memberIdx] ?? "");
        const memberIdNum = rawMember ? parseInt(rawMember.replace(/\D/g, ""), 10) : NaN;
        const member_id = Number.isFinite(memberIdNum) ? memberIdNum : null;
        const note = cleanValue(row[noteIdx] ?? "");
        parsed.push({ display_name: name, phone, member_id, note });
      }

      if (parsed.length === 0) {
        throw new Error("Geen geldige rijen gevonden. Controleer of de naamkolom gevuld is.");
      }

      setParsedRows(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Onbekende fout bij inlezen");
      setParsedRows([]);
    } finally {
      setIsParsing(false);
    }
  };

  const stats = useMemo(() => {
    let newCount = 0;
    let existingCount = 0;
    let noPhoneCount = 0;
    for (const row of parsedRows) {
      const canonical = normalizePhone(row.phone);
      if (!canonical) {
        noPhoneCount++;
      } else if (existingPhones.has(canonical)) {
        existingCount++;
      } else {
        newCount++;
      }
    }
    return { total: parsedRows.length, newCount, existingCount, noPhoneCount };
  }, [parsedRows, existingPhones]);

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    setIsImporting(true);

    try {
      type UpdatePayload = {
        display_name: string;
        sort_key: string;
        phone?: string;
        member_id?: number;
        note?: string;
      };
      const toUpdate: { id: string; update: UpdatePayload }[] = [];
      const toInsert: { display_name: string; phone: string | null; member_id: number | null; note: string | null; sort_key: string }[] = [];

      for (const row of parsedRows) {
        const canonical = normalizePhone(row.phone);
        if (canonical && existingPhones.has(canonical)) {
          // Alleen niet-lege waarden overschrijven: bestaande koppelingen en
          // notities blijven behouden als de CSV die kolom niet vult.
          const update: UpdatePayload = {
            display_name: row.display_name,
            sort_key: row.display_name.toLowerCase().trim(),
          };
          if (row.phone) update.phone = row.phone;
          if (row.member_id != null) update.member_id = row.member_id;
          if (row.note) update.note = row.note;
          toUpdate.push({ id: existingPhones.get(canonical)!, update });
        } else {
          toInsert.push({
            display_name: row.display_name,
            phone: row.phone,
            member_id: row.member_id,
            note: row.note,
            sort_key: row.display_name.toLowerCase().trim(),
          });
        }
      }

      let inserted = 0;
      let updated = 0;

      if (toInsert.length > 0) {
        const { data, error } = await supabase
          .from("whatsapp_participants")
          .insert(toInsert)
          .select("id");
        if (error) throw error;
        inserted = data?.length ?? toInsert.length;
      }

      for (const row of toUpdate) {
        const { error } = await supabase
          .from("whatsapp_participants")
          .update(row.update)
          .eq("id", row.id);
        if (error) throw error;
        updated++;
      }

      toast.success(`${inserted} nieuwe deelnemers geïmporteerd, ${updated} bijgewerkt.`);
      onSuccess();
      handleOpenChange(false);
    } catch (err) {
      toast.error("Importeren mislukt", { description: err instanceof Error ? err.message : "Onbekende fout" });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload size={18} className="text-brand-red" />
            WhatsApp-deelnemers importeren
          </DialogTitle>
          <DialogDescription>
            Upload een CSV-bestand met minimaal een kolom "Naam". Optioneel ook "Telefoon", "Lidnummer" en "Notitie".
            Deelnemers met hetzelfde telefoonnummer worden bijgewerkt in plaats van gedupliceerd.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="csv-upload">Bestand (CSV)</Label>
            <Input
              id="csv-upload"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={isParsing || isImporting}
            />
          </div>

          {isParsing && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <FileSpreadsheet size={14} /> Bestand inlezen…
            </div>
          )}

          {parseError && (
            <div className="flex items-start gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/10 text-sm text-destructive">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-sm bg-muted">Totaal: {stats.total}</span>
                <span className="px-2 py-1 rounded-sm bg-green-100 text-green-800">Nieuw: {stats.newCount}</span>
                <span className="px-2 py-1 rounded-sm bg-blue-100 text-blue-800">Bijwerken: {stats.existingCount}</span>
                {stats.noPhoneCount > 0 && (
                  <span className="px-2 py-1 rounded-sm bg-amber-100 text-amber-800">Geen telefoon: {stats.noPhoneCount}</span>
                )}
              </div>

              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Naam</TableHead>
                      <TableHead>Telefoon</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Lidnr</TableHead>
                      <TableHead>Notitie</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 50).map((row, idx) => {
                      const canonical = normalizePhone(row.phone);
                      let status = "Nieuw";
                      let statusClass = "text-green-700";
                      if (!canonical) {
                        status = "Geen telefoon";
                        statusClass = "text-amber-700";
                      } else if (existingPhones.has(canonical)) {
                        status = "Bijwerken";
                        statusClass = "text-blue-700";
                      }
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{row.display_name}</TableCell>
                          <TableCell className="font-mono text-xs">{row.phone ?? "—"}</TableCell>
                          <TableCell className={`text-xs ${statusClass}`}>{status}</TableCell>
                          <TableCell className="text-xs">{row.member_id ?? "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{row.note ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {parsedRows.length > 50 && (
                <p className="text-xs text-muted-foreground">
                  … en nog {parsedRows.length - 50} rij(en) die niet in de preview staan.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isImporting}>
            Annuleren
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsedRows.length === 0 || isParsing || isImporting}
            className="bg-brand-red hover:bg-brand-red/90 text-white"
          >
            {isImporting ? "Importeren…" : `${stats.total} deelnemer(s) importeren`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
