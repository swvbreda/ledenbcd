import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Paperclip, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CurrencyCell, CurrencyText } from "@/components/budget/CurrencyAmount";
import DossierInvoiceThumb, { useDocumentUrl } from "@/components/budget/DossierInvoiceThumb";
import {
  useExpenseDocumentActions,
  type DossierMutation,
  type ExpenseDocument,
} from "@/hooks/useDossiers";

const formatDate = (value: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
};

function DocumentViewer({ doc, onClose }: { doc: ExpenseDocument; onClose: () => void }) {
  const { data: url } = useDocumentUrl(doc.file_path);
  const isPdf = (doc.mime_type || "").includes("pdf") || doc.file_name.toLowerCase().endsWith(".pdf");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8 text-base">{doc.file_name}</DialogTitle>
        </DialogHeader>
        <div className="h-[70vh] w-full overflow-auto rounded-md border border-border bg-muted/20">
          {!url ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Laden…</div>
          ) : isPdf ? (
            <iframe src={url} title={doc.file_name} className="h-full w-full border-0" />
          ) : (
            <img src={url} alt={doc.file_name} className="mx-auto max-h-full" />
          )}
        </div>
        <div className="flex justify-end">
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" download={doc.file_name}>
              <Button variant="outline" size="sm">
                <Download className="mr-1 h-3.5 w-3.5" /> Downloaden
              </Button>
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface Props {
  dossier: string;
  year: number;
  entries: DossierMutation[];
  documents: ExpenseDocument[];
  isAdmin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemoveFromDossier?: (entry: DossierMutation) => void;
}

export default function DossierDetailDialog({
  dossier,
  year,
  entries,
  documents,
  isAdmin,
  open,
  onOpenChange,
  onRemoveFromDossier,
}: Props) {
  const { upload, remove } = useExpenseDocumentActions();
  const [viewing, setViewing] = useState<ExpenseDocument | null>(null);
  const [uploadTarget, setUploadTarget] = useState<DossierMutation | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const docsByEntry = useMemo(() => {
    const map = new Map<string, ExpenseDocument[]>();
    for (const d of documents) {
      if (!map.has(d.entry_key)) map.set(d.entry_key, []);
      map.get(d.entry_key)!.push(d);
    }
    return map;
  }, [documents]);

  const totals = useMemo(() => {
    const out = entries.filter((e) => e.direction === "out").reduce((s, e) => s + e.amount, 0);
    const income = entries.filter((e) => e.direction === "in").reduce((s, e) => s + e.amount, 0);
    return { out, income, saldo: income - out };
  }, [entries]);

  const pickFiles = (entry: DossierMutation) => {
    setUploadTarget(entry);
    fileInput.current?.click();
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0 || !uploadTarget) return;
    upload.mutate(
      { entry: uploadTarget, files: Array.from(files), year },
      {
        onSuccess: () => toast.success("Factuur toegevoegd"),
        onError: (e: any) => toast.error(e?.message || "Uploaden mislukt"),
      },
    );
    setUploadTarget(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>{dossier}</DialogTitle>
            <DialogDescription>
              {entries.length} mutatie{entries.length === 1 ? "" : "s"} in {year} · {documents.length} factuur
              {documents.length === 1 ? "" : "en"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Uitgaven", value: totals.out, cls: "text-destructive" },
              { label: "Inkomsten", value: totals.income, cls: "text-green-600" },
              { label: "Saldo", value: totals.saldo, cls: totals.saldo < 0 ? "text-destructive" : "text-green-600" },
            ].map((k) => (
              <div key={k.label} className="rounded-md border border-border p-3">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={`text-lg font-semibold ${k.cls}`}>
                  <CurrencyText value={k.value} />
                </p>
              </div>
            ))}
          </div>

          <ScrollArea className="max-h-[45vh] rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="border-b border-border/60">
                  <th className="px-3 py-1.5 text-left font-medium">Datum</th>
                  <th className="px-3 py-1.5 text-left font-medium">Tegenpartij</th>
                  <th className="px-3 py-1.5 text-left font-medium">Omschrijving</th>
                  <th className="px-3 py-1.5 text-left font-medium">Factuurnr</th>
                  <th className="px-3 py-1.5 text-left font-medium">Begrotingspost</th>
                  <th className="px-3 py-1.5 text-right font-medium">Bedrag</th>
                  <th className="px-2 py-1.5 text-left font-medium">Factuur</th>
                  {isAdmin && onRemoveFromDossier && <th className="w-8" />}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const docs = docsByEntry.get(e.key) || [];
                  return (
                    <tr key={e.key} className="group border-b border-border/30 hover:bg-muted/20">
                      <td className="whitespace-nowrap px-3 py-1 tabular-nums">{formatDate(e.date)}</td>
                      <td className="px-3 py-1">{e.counterparty || "—"}</td>
                      <td className="max-w-[260px] px-3 py-1 text-muted-foreground">
                        <span className="line-clamp-2">{e.description}</span>
                      </td>
                      <td className="px-3 py-1 tabular-nums">{e.invoice}</td>
                      <td className="px-3 py-1 text-muted-foreground">
                        {e.lineItemName ? `${e.categoryName} / ${e.lineItemName}` : "Niet gekoppeld"}
                      </td>
                      <td className={`px-3 py-1 text-right ${e.direction === "in" ? "text-green-600" : ""}`}>
                        <CurrencyCell value={e.direction === "in" ? e.amount : -e.amount} />
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          {docs.length > 0 && (
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-brand-red hover:underline"
                              onClick={() => setViewing(docs[0])}
                            >
                              <Paperclip className="h-3 w-3" />
                              {docs.length}
                            </button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => pickFiles(e)}
                              title="Factuur uploaden"
                            >
                              <Upload className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      </td>
                      {isAdmin && onRemoveFromDossier && (
                        <td className="px-1 py-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => onRemoveFromDossier(e)}
                            title="Uit dossier halen"
                          >
                            <X className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>

          <div>
            <h4 className="mb-2 text-sm font-semibold">Facturen</h4>
            {documents.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nog geen facturen in dit dossier. Upload een PDF of foto via het uploadicoon bij een mutatie.
              </p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {documents.map((d) => {
                  const entry = entries.find((e) => e.key === d.entry_key);
                  return (
                    <DossierInvoiceThumb
                      key={d.id}
                      doc={d}
                      caption={entry ? `${entry.counterparty || entry.description} · ${entry.invoice || formatDate(entry.date)}` : d.file_name}
                      onOpen={setViewing}
                      onDelete={
                        isAdmin
                          ? (doc) =>
                              remove.mutate(doc, {
                                onSuccess: () => toast.success("Factuur verwijderd"),
                                onError: (err: any) => toast.error(err?.message || "Verwijderen mislukt"),
                              })
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </DialogContent>
      </Dialog>

      {viewing && <DocumentViewer doc={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}
