import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, ExternalLink, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getBcdDocumenten } from "@/lib/bcdDocumenten.functions";
import type { DocumentenResultaat, FoutReden } from "@/lib/bcdDocumenten";

export const FOUT_TEKST: Record<FoutReden, string> = {
  geen_toegang: "Je hebt geen toegang tot deze bronstukken.",
  niet_geconfigureerd: "De koppeling met de Beleidsmonitor is nog niet ingericht. Dit zegt niets over het aantal publicaties.",
  bron_onbereikbaar: "De Beleidsmonitor is nu niet bereikbaar. Probeer het later opnieuw.",
  incompatibel: "De Beleidsmonitor gaf een onverwacht antwoord. De documenten kunnen nu niet worden getoond.",
  te_veel_verzoeken: "Te veel verzoeken in korte tijd. Wacht even en probeer opnieuw.",
  ongeldige_invoer: "Deze gemeente kan niet worden opgevraagd.",
};

type Props = { gemeentenaam?: string; gmCode?: string };

export default function BeleidDocumentenLijst({ gemeentenaam, gmCode }: Props) {
  const { user } = useAuth();
  const fetchDocs = useServerFn(getBcdDocumenten);
  const target = gmCode ?? gemeentenaam ?? "";

  const q = useInfiniteQuery({
    // user-scoped en per gemeente: een oud antwoord kan nooit bij een andere gemeente landen
    queryKey: ["bcd-documenten", user?.id ?? "anon", gmCode ? "gm" : "naam", target],
    enabled: !!user && !!target,
    staleTime: 2 * 60_000,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchDocs({ data: gmCode ? { gm_code: gmCode, cursor: pageParam } : { gemeentenaam: gemeentenaam!, cursor: pageParam } }) as Promise<DocumentenResultaat>,
    getNextPageParam: (last) => (last.status === "ok" ? last.volgende_cursor ?? undefined : undefined),
  });

  if (q.isPending) {
    return (
      <div role="status" className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Documenten ophalen…
      </div>
    );
  }

  const first = q.data?.pages[0];
  const errorPage = q.data?.pages.find((p) => p.status === "fout") as Extract<DocumentenResultaat, { status: "fout" }> | undefined;
  if (q.isError || !first || (first.status === "fout")) {
    const reden = errorPage?.reden ?? "bron_onbereikbaar";
    return <Melding tone="error" text={FOUT_TEKST[reden]} />;
  }
  if (first.status === "niet_gekoppeld") {
    return <Melding text="Deze gemeente is niet gekoppeld aan de Beleidsmonitor, dus er kunnen geen bronstukken worden getoond." />;
  }

  const docs = q.data!.pages.flatMap((p) => (p.status === "ok" ? p.documenten : []));
  if (docs.length === 0) return <Melding text={`Er zijn geen openbare publicaties bekend voor ${first.gemeente.naam}.`} />;

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {docs.map((doc) => (
          <li key={doc.id}>
            <a
              href={doc.bron_url}
              target="_blank"
              rel="noopener noreferrer"
              className="border rounded-lg p-3 text-sm hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors flex items-start justify-between gap-2 group min-w-0"
            >
              <span className="flex items-start gap-2 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium text-foreground break-words group-hover:text-primary">{doc.titel}</span>
                  <span className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className={`text-xs text-muted-foreground ${doc.documentdatum ? "tabular-nums" : "italic"}`}>
                      {doc.documentdatum ? new Date(doc.documentdatum).toLocaleDateString("nl-NL") : "Datum onbekend"}
                    </span>
                    {doc.documentsoort && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">{doc.documentsoort}</Badge>
                    )}
                  </span>
                </span>
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" aria-hidden />
              <span className="sr-only">(opent originele bron in nieuw venster)</span>
            </a>
          </li>
        ))}
      </ul>
      {errorPage && <Melding tone="error" text={FOUT_TEKST[errorPage.reden]} />}
      {q.hasNextPage && !errorPage && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {q.isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Meer laden
        </Button>
      )}
    </div>
  );
}

function Melding({ text, tone }: { text: string; tone?: "error" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 p-3 rounded-lg text-sm ${tone === "error" ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-muted-foreground"}`}
    >
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      <span>{text}</span>
    </div>
  );
}
