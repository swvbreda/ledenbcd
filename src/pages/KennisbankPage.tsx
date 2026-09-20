import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Lock,
  Search,
} from "lucide-react";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import {
  getKnowledgeDocumentUrl,
  loadKnowledgeBase,
  type KnowledgeDocument,
  type KnowledgeDossier,
} from "@/lib/knowledgeBase";
import { toast } from "sonner";

function matchesSearch(dossier: KnowledgeDossier, query: string) {
  const haystack = [
    dossier.titel,
    dossier.thema,
    dossier.beschrijving,
    dossier.standpunt,
    ...dossier.kerncijfers.flatMap((item) => [
      item.label,
      item.waarde,
      item.toelichting ?? "",
    ]),
    ...dossier.qa.flatMap((item) => [item.vraag, item.antwoord]),
  ]
    .join(" ")
    .toLocaleLowerCase("nl-NL");
  return haystack.includes(query);
}

const CARD_TONES = [
  "bg-card text-foreground",
  "bg-muted text-foreground",
  "bg-brand-red text-white",
  "bg-card text-foreground",
] as const;

function dossierUrl(dossier: KnowledgeDossier) {
  if (dossier.path.startsWith("https://")) return dossier.path;
  return `https://coffeeshopbond.nl${dossier.path.startsWith("/") ? "" : "/"}${dossier.path}`;
}

function DossierItem({
  dossier,
  index,
}: {
  dossier: KnowledgeDossier;
  index: number;
}) {
  const isRed = index % CARD_TONES.length === 2;
  return (
    <AccordionItem
      value={dossier.slug}
      className={`group min-w-0 overflow-hidden rounded-3xl border border-border/80 shadow-sm transition-shadow hover:shadow-xl ${CARD_TONES[index % CARD_TONES.length]}`}
    >
      {dossier.afbeelding && (
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          <img
            src={dossier.afbeelding}
            alt={`Cover ${dossier.titel}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <span className="absolute left-4 top-4 rounded-full bg-brand-red px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            {dossier.status ?? "Kennispagina"}
          </span>
          {dossier.badge === "hop" && (
            <span className="absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground shadow">
              HOP
            </span>
          )}
        </div>
      )}
      <AccordionTrigger className="items-start gap-3 px-6 py-6 text-left hover:no-underline sm:px-7">
        <div className="min-w-0 flex-1 pr-2">
          <div
            className={`mb-3 flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] ${isRed ? "text-white/80" : "text-brand-red"}`}
          >
            <span className="h-px w-6 shrink-0 bg-current opacity-60" />
            {dossier.thema}
          </div>
          <h2 className="break-words font-display text-xl uppercase leading-[1.08] sm:text-2xl">
            {dossier.titel}
          </h2>
          <p
            className={`mt-3 break-words text-sm font-normal leading-relaxed ${isRed ? "text-white/85" : "text-muted-foreground"}`}
          >
            {dossier.beschrijving}
          </p>
          <p
            className={`mt-5 text-xs font-bold uppercase tracking-wide ${isRed ? "text-white" : "text-brand-red"}`}
          >
            Bekijk inhoud
          </p>
        </div>
      </AccordionTrigger>
      <AccordionContent className="space-y-5 px-6 pb-6 pt-0 sm:px-7">
        {dossier.standpunt && (
          <div
            className={`rounded-xl border-l-4 p-4 ${isRed ? "border-white bg-white/10" : "border-brand-red bg-muted/45"}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-red">
              Standpunt BCD
            </p>
            <p className="mt-1 text-sm leading-relaxed">{dossier.standpunt}</p>
          </div>
        )}

        {dossier.kerncijfers.length > 0 && (
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            {dossier.kerncijfers.map((item) => (
              <div
                key={`${item.label}-${item.waarde}`}
                className="min-w-0 rounded-lg border bg-card p-3"
              >
                <p className="break-words text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 break-words text-lg font-bold text-foreground">
                  {item.waarde}
                </p>
                {item.toelichting && (
                  <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                    {item.toelichting}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <Accordion type="multiple" className="w-full min-w-0">
          {dossier.qa.length > 0 && (
            <AccordionItem value="vragen">
              <AccordionTrigger className="text-left">
                Veelgestelde vragen
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {dossier.qa.map((item) => (
                    <div key={item.vraag} className="min-w-0">
                      <p className="break-words text-sm font-semibold">
                        {item.vraag}
                      </p>
                      <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
                        {item.antwoord}
                      </p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
          {dossier.bronnen.length > 0 && (
            <AccordionItem value="bronnen">
              <AccordionTrigger className="text-left">Bronnen</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-3">
                  {dossier.bronnen.map((bron) => (
                    <li
                      key={`${bron.titel}-${bron.verwijzing}`}
                      className="min-w-0 text-sm"
                    >
                      <p className="break-words font-medium">{bron.titel}</p>
                      <p className="break-words text-muted-foreground">
                        {bron.verwijzing}
                      </p>
                      {bron.url && (
                        <a
                          href={bron.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-brand-red hover:underline"
                        >
                          Open bron <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        {(dossier.links.length > 0 || dossier.cta) && (
          <div className="flex flex-wrap gap-2">
            {dossier.links.map((link) => (
              <Button
                key={`${link.label}-${link.href}`}
                asChild
                size="sm"
                variant={isRed ? "secondary" : "outline"}
                className="h-auto whitespace-normal rounded-full"
              >
                <a href={link.href} target="_blank" rel="noopener noreferrer">
                  {link.members && <Lock className="h-3.5 w-3.5" />}
                  {link.label}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            ))}
            {dossier.cta && (
              <Button
                asChild
                size="sm"
                className="h-auto whitespace-normal rounded-full"
              >
                <a
                  href={dossier.cta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {dossier.cta.members && <Lock className="h-3.5 w-3.5" />}
                  {dossier.cta.label}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        )}

        <Button
          asChild
          variant={isRed ? "secondary" : "outline"}
          className="w-full whitespace-normal"
        >
          <a
            href={dossierUrl(dossier)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Volledig dossier op Coffeeshopbond.nl
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </AccordionContent>
    </AccordionItem>
  );
}

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

  if (documenten.length === 0) return null;

  return (
    <Card className="min-w-0 overflow-hidden border-brand-red/25">
      <Accordion type="single" collapsible>
        <AccordionItem value="documenten" className="border-0">
          <AccordionTrigger className="bg-brand-red/5 px-4 py-4 text-left hover:no-underline sm:px-6">
            <div className="min-w-0 pr-3">
              <CardTitle className="break-words font-display text-xl sm:text-2xl">
                Brieven en bestanden
              </CardTitle>
              <p className="mt-1 text-sm font-normal leading-relaxed text-muted-foreground">
                {documenten.length} documenten, juridische analyses en interne
                notities
              </p>
              <p className="mt-2 text-xs font-medium text-brand-red">
                Bekijk bestanden
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-0">
            <CardContent className="p-0">
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
                              <Badge variant="secondary">Interne notitie</Badge>
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
            </CardContent>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

export default function KennisbankPage() {
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["leden-kennisbank", session?.user.id],
    queryFn: () => loadKnowledgeBase(session!),
    enabled: Boolean(session),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const dossiers = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("nl-NL");
    if (!normalized) return query.data?.dossiers ?? [];
    return (query.data?.dossiers ?? []).filter((dossier) =>
      matchesSearch(dossier, normalized),
    );
  }, [query.data?.dossiers, search]);

  return (
    <div className="w-full min-w-0 max-w-full space-y-5 overflow-x-hidden p-4 sm:p-6">
      <BcdHeroBanner
        title="Kennisbank"
        subtitle="Alles wat nu speelt in de coffeeshopbranche én de onderwerpen achter het beleid"
      />

      <div className="relative max-w-2xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Zoek in dossiers, onderwerpen en vragen…"
          className="pl-10"
        />
      </div>

      {query.isLoading && (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-brand-red" />
          Kennisbank laden…
        </div>
      )}

      {query.isError && (
        <Alert variant="destructive">
          <BookOpen className="h-4 w-4" />
          <AlertTitle>Kennisbank kon niet worden geladen</AlertTitle>
          <AlertDescription>
            Controleer de internetverbinding en probeer het opnieuw.
            <Button
              variant="outline"
              size="sm"
              className="ml-3 mt-2"
              onClick={() => query.refetch()}
            >
              Opnieuw proberen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!query.isLoading && !query.isError && dossiers.length === 0 && (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          Geen dossiers gevonden voor “{search}”.
        </div>
      )}

      {dossiers.length > 0 && (
        <section className="min-w-0 space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-red">
                Dossiers & kennisbank
              </p>
              <h2 className="mt-2 font-display text-2xl uppercase sm:text-3xl">
                Dossiers en onderwerpen
              </h2>
              <p className="text-sm text-muted-foreground">
                Wat er nu speelt en de kennis eronder — zoek op trefwoord.
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {dossiers.length}
            </Badge>
          </div>
          <Accordion
            type="single"
            collapsible
            className="grid min-w-0 grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            {dossiers.map((dossier, index) => (
              <DossierItem key={dossier.slug} dossier={dossier} index={index} />
            ))}
          </Accordion>
        </section>
      )}

      {query.data && <DocumentsPanel documenten={query.data.documenten} />}
    </div>
  );
}
