import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, FileText, Loader2 } from "lucide-react";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { getKnowledgeDocumentUrl, loadKnowledgeDocuments, type KnowledgeDocument } from "@/lib/knowledgeBase";
import { groupDocuments } from "@/lib/importantDocuments";
import { toast } from "sonner";

export default function BelangrijkeDocumentenPage() {
  const { session } = useAuth();
  const [subject, setSubject] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["leden-kennisbank-documenten", session?.user.id],
    queryFn: () => {
      if (!session) throw new Error("Log in om documenten te bekijken");
      return loadKnowledgeDocuments(session);
    },
    enabled: Boolean(session), staleTime: 5 * 60 * 1000, retry: 1,
  });
  const documents = query.data ?? [];
  const allGroups = groupDocuments(documents);
  const groups = groupDocuments(documents, subject);

  async function openDocument(document: KnowledgeDocument) {
    if (!session || !document.beschikbaar) return;
    setBusy(document.id);
    try {
      const url = await getKnowledgeDocumentUrl(session, document.id);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      toast.error("Bestand kon niet worden geopend", { description: error instanceof Error ? error.message : undefined });
    } finally { setBusy(null); }
  }

  return <div className="w-full min-w-0 space-y-6 overflow-x-hidden p-3 sm:p-6">
    <BcdHeroBanner title="Belangrijke documenten" />
    {query.isError && <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" /><AlertTitle>Documenten konden niet worden geladen</AlertTitle>
      <AlertDescription><Button variant="outline" size="sm" onClick={() => query.refetch()}>Opnieuw proberen</Button></AlertDescription>
    </Alert>}
    {query.isLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-brand-red" />Documenten laden…</p>}
    {query.data && <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-sm"><label id="subject-label" className="mb-2 block text-sm font-semibold">Onderwerp</label>
          <Select value={subject} onValueChange={setSubject}><SelectTrigger aria-labelledby="subject-label"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Alle onderwerpen ({documents.length})</SelectItem>
              {allGroups.map(group => <SelectItem key={group.name} value={group.name}>{group.name} ({group.documents.length})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p aria-live="polite" className="text-sm text-muted-foreground">{groups.reduce((total, group) => total + group.documents.length, 0)} documenten</p>
      </div>
      {groups.length === 0 && <p className="text-sm text-muted-foreground">Geen documenten beschikbaar.</p>}
      {groups.map(group => <section key={group.name} className="min-w-0" aria-label={group.name}>
        <h2 className="mb-3 border-b-2 border-primary/60 pb-2 font-display text-xl">{group.name} <span className="font-sans text-sm text-muted-foreground">({group.documents.length})</span></h2>
        <ul className="divide-y divide-border">{group.documents.map(document => <li id={document.id} key={document.id} className="min-w-0 py-5">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><FileText className="h-4 w-4 text-brand-red" />{document.datumLabel || "Datum onbekend"}{document.soort === "notitie" && <Badge variant="secondary">Interne notitie</Badge>}</div>
              <h3 className="mt-2 break-words font-semibold">{document.titel}</h3>
              {(document.aan || document.van) && <p className="mt-1 break-words text-xs text-muted-foreground">{document.aan ? `Aan: ${document.aan}` : `Van: ${document.van}`}</p>}
              <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">{document.kern}</p>
            </div>
            <Button size="sm" className="w-full shrink-0 sm:w-auto" disabled={!document.beschikbaar || busy === document.id} onClick={() => openDocument(document)}>
              {busy === document.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{document.beschikbaar ? "Open PDF" : "Nog niet beschikbaar"}
            </Button>
          </div>
        </li>)}</ul>
      </section>)}
    </>}
  </div>;
}