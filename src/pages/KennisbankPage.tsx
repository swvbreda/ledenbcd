import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Download,
  ExternalLink,
  FileText,
  Loader2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import {
  getKnowledgeDocumentUrl,
  loadKnowledgeDocuments,
  type KnowledgeDocument,
} from "@/lib/knowledgeBase";
import { toast } from "sonner";

const KENNISBANK_URL = "https://coffeeshopbond.nl/kennisbank";

function DocumentsPanel({ documenten }: { documenten: KnowledgeDocument[] }) {
  const { session } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  const openDocument = async (document: KnowledgeDocument) => {
    if (!session || !document.beschikbaar) return;
    setBusy(document.id);
    try {
      const url = await getKnowledgeDocumentUrl(session, document.id);
      const opened = window.open(url, "_blank", "noopener,noreferrer");
      if (!opened) window.location.assign(url);
    } catch (error) {
      toast.error("Bestand kon niet worden geopend", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="min-w-0 overflow-hidden border-brand-red/25">
      <Accordion type="single" collapsible>
        <AccordionItem value="documenten" className="border-0">
          <AccordionTrigger className="bg-brand-red/5 px-4 py-4 text-left hover:no-underline sm:px-6">
            <div className="min-w-0 pr-3">
              <CardTitle className="break-words font-display text-xl sm:text-2xl">
                Brieven en bestanden voor leden
              </CardTitle>
              <p className="mt-1 text-sm font-normal leading-relaxed text-muted-foreground">
                {documenten.length} documenten, juridische analyses en interne
                notities
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            <CardContent className="p-0">
              {documenten.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground sm:p-5">
                  Er staan op dit moment geen ledenbestanden klaar.
                </p>
              ) : (
                <ul className="divide-y">
                  {[...documenten]
                    .sort((a, b) => b.datum.localeCompare(a.datum))
                    .map((document) => (
                      <li key={document.id} className="min-w-0 p-4 sm:p-5">
                        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                              <FileText className="h-4 w-4 shrink-0 text-brand-red" />
                              <span>{document.datumLabel}</span>
                              {document.soort === "notitie" && (
                                <Badge variant="secondary">
                                  Interne notitie
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 break-words font-semibold leading-snug">
                              {document.titel}
                            </p>
                            {(document.aan || document.van) && (
                              <p className="mt-1 break-words text-xs text-muted-foreground">
                                {document.aan
                                  ? `Aan: ${document.aan}`
                                  : `Van: ${document.van}`}
                              </p>
                            )}
                            <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">
                              {document.kern}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            className="w-full shrink-0 sm:w-auto"
                            disabled={
                              !document.beschikbaar || busy === document.id
                            }
                            onClick={() => openDocument(document)}
                          >
                            {busy === document.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            {document.beschikbaar
                              ? "Open PDF"
                              : "Nog niet beschikbaar"}
                          </Button>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

export default function KennisbankPage() {
  const { session } = useAuth();
  const documents = useQuery({
    queryKey: ["leden-kennisbank-documenten", session?.user.id],
    queryFn: () => loadKnowledgeDocuments(session!),
    enabled: Boolean(session),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 overflow-x-hidden p-3 sm:p-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="min-w-0">
          <p className="break-words font-display text-base uppercase leading-tight sm:text-lg">
            BCD Kennisbank
          </p>
          <p className="break-words text-xs text-muted-foreground">
            Live en automatisch gelijk aan coffeeshopbond.nl
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <a href={KENNISBANK_URL} target="_blank" rel="noopener noreferrer">
            Open apart
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>

      <div className="min-w-0 max-w-full overflow-hidden rounded-xl border bg-card">
        <iframe
          src={KENNISBANK_URL}
          title="BCD Kennisbank"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block h-[calc(100vh-14rem)] min-h-[520px] w-full max-w-full border-0"
        />
      </div>

      {documents.isError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Ledenbestanden konden niet worden geladen</AlertTitle>
          <AlertDescription>
            De kennisbank hierboven werkt gewoon. Probeer de beveiligde
            bestanden opnieuw op te halen.
            <Button
              variant="outline"
              size="sm"
              className="ml-3 mt-2"
              onClick={() => documents.refetch()}
            >
              Opnieuw proberen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {documents.isLoading && (
        <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-brand-red" />
          Ledenbestanden laden…
        </div>
      )}

      {documents.data && <DocumentsPanel documenten={documents.data} />}
    </div>
  );
}
