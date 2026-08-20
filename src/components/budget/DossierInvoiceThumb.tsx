import { useQuery } from "@tanstack/react-query";
import { FileText, Trash2 } from "lucide-react";
import { getDocumentUrl, type ExpenseDocument } from "@/hooks/useDossiers";
import { Button } from "@/components/ui/button";

export function useDocumentUrl(path: string) {
  return useQuery({
    queryKey: ["expense-document-url", path],
    queryFn: () => getDocumentUrl(path),
    staleTime: 45 * 60 * 1000,
  });
}

interface Props {
  doc: ExpenseDocument;
  onOpen: (doc: ExpenseDocument) => void;
  onDelete?: (doc: ExpenseDocument) => void;
  caption?: string;
}

export default function DossierInvoiceThumb({ doc, onOpen, onDelete, caption }: Props) {
  const { data: url, isLoading } = useDocumentUrl(doc.file_path);
  const isPdf = (doc.mime_type || "").includes("pdf") || doc.file_name.toLowerCase().endsWith(".pdf");

  return (
    <div className="group relative w-[150px] shrink-0">
      <button
        type="button"
        onClick={() => onOpen(doc)}
        className="block h-[190px] w-full overflow-hidden rounded-md border border-border bg-muted/30 text-left hover:border-primary"
        title={doc.file_name}
      >
        {isLoading || !url ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <FileText className="h-6 w-6" />
          </div>
        ) : isPdf ? (
          <div className="pointer-events-none h-full w-full overflow-hidden">
            <iframe
              src={`${url}#toolbar=0&navpanes=0&view=FitH`}
              title={doc.file_name}
              className="h-[380px] w-[300px] origin-top-left scale-50 border-0"
            />
          </div>
        ) : (
          <img src={url} alt={doc.file_name} className="h-full w-full object-cover" loading="lazy" />
        )}
      </button>
      <p className="mt-1 truncate text-[11px] text-muted-foreground" title={caption || doc.file_name}>
        {caption || doc.file_name}
      </p>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1 h-6 w-6 bg-background/80 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => onDelete(doc)}
          title="Factuur verwijderen"
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      )}
    </div>
  );
}
