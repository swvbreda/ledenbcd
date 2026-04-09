import { useState, useCallback, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, FileText, Loader2, ExternalLink,
  ChevronDown, ChevronUp, AlertCircle, Notebook,
  Sparkles, Building2, MapPin, Shield, Ruler,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MunicipalDocument {
  id: string;
  score: number;
  name: string;
  url: string | null;
  date: string | null;
  organization: string;
  description: string | null;
  source?: string;
}

interface PolicySummary {
  beleidsmaximum: string;
  feitelijk_aantal: string;
  beleidsstatus: string;
  afstandscriterium: string;
  samenvatting: string;
  bronnen: string[];
}

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  lokaleregelgeving: { label: "Beleidsregel", className: "text-green-700 border-green-300 bg-green-50" },
  officielebekendmakingen: { label: "Officiële Bekendmaking", className: "text-purple-700 border-purple-300 bg-purple-50" },
  notubiz: { label: "Notubiz", className: "text-accent border-accent/30" },
  parlaeus: { label: "Parlaeus", className: "text-blue-700 border-blue-300 bg-blue-50" },
  ori: { label: "Open Raadsinformatie", className: "text-muted-foreground border-border" },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  gedoogbeleid: { label: "Gedoogbeleid", color: "text-green-700 bg-green-50 border-green-200" },
  nulbeleid: { label: "Nulbeleid", color: "text-red-700 bg-red-50 border-red-200" },
  uitsterfbeleid: { label: "Uitsterfbeleid", color: "text-amber-700 bg-amber-50 border-amber-200" },
  onbekend: { label: "Onbekend", color: "text-muted-foreground bg-muted/50 border-border" },
};

interface GemeentePublicatiesProps {
  gemeentenaam: string;
}

export default function GemeentePublicaties({ gemeentenaam }: GemeentePublicatiesProps) {
  const [zoektermen, setZoektermen] = useState("coffeeshop beleid maximum");
  const [documents, setDocuments] = useState<MunicipalDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const autoSearchDone = useRef<string | null>(null);

  const [summary, setSummary] = useState<PolicySummary | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const summaryDone = useRef<string | null>(null);

  const fetchSummary = useCallback(async (docs: MunicipalDocument[]) => {
    if (!docs.length || summaryDone.current === gemeentenaam) return;
    summaryDone.current = gemeentenaam;
    setIsSummarizing(true);
    setSummaryError(null);

    try {
      const { data, error } = await supabase.functions.invoke("summarize-municipal-policy", {
        body: { gemeentenaam, documents: docs },
      });
      if (error) throw error;
      if (data?.summary) setSummary(data.summary);
    } catch (err: any) {
      console.error("Summary error:", err);
      setSummaryError("Samenvatting kon niet worden opgehaald.");
    } finally {
      setIsSummarizing(false);
    }
  }, [gemeentenaam]);

  const handleSearch = useCallback(async () => {
    if (!gemeentenaam.trim()) return;
    setIsSearching(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke("search-municipal-docs", {
        body: { gemeentenaam, keywords: zoektermen },
      });
      if (error) throw error;
      const docs = data.documents || [];
      setDocuments(docs);
      setTotal(data.total || 0);

      // Trigger AI summary after docs load
      if (docs.length > 0) fetchSummary(docs);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  }, [gemeentenaam, zoektermen, fetchSummary]);

  // Auto-search on mount
  useEffect(() => {
    if (!gemeentenaam.trim() || gemeentenaam.trim().length < 3) return;
    if (autoSearchDone.current === gemeentenaam) return;
    autoSearchDone.current = gemeentenaam;
    const timer = setTimeout(() => handleSearch(), 400);
    return () => clearTimeout(timer);
  }, [gemeentenaam]);

  return (
    <div className="bg-card rounded-lg border border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <h3 className="text-sm font-semibold font-display flex items-center gap-2">
          <Notebook size={16} className="text-primary" />
          Gemeentebeleid &amp; Raadsinformatie
          {isSearching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </h3>
        <span className="flex items-center gap-2">
          {documents.length > 0 && (
            <Badge variant="outline" className="text-xs font-normal">
              {total} documenten
            </Badge>
          )}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* AI Summary Card */}
          {isSummarizing && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles size={14} className="animate-pulse" />
                AI-analyse wordt opgesteld...
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-md" />
                ))}
              </div>
              <Skeleton className="h-10 rounded-md" />
            </div>
          )}

          {summary && !isSummarizing && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles size={14} />
                AI-beleidsanalyse
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-card rounded-md border p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                    <Building2 size={12} />
                    Maximum
                  </div>
                  <p className="text-lg font-bold font-display">{summary.beleidsmaximum}</p>
                </div>
                <div className="bg-card rounded-md border p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                    <MapPin size={12} />
                    Feitelijk
                  </div>
                  <p className="text-lg font-bold font-display">{summary.feitelijk_aantal}</p>
                </div>
                <div className="bg-card rounded-md border p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                    <Shield size={12} />
                    Status
                  </div>
                  {(() => {
                    const s = STATUS_LABELS[summary.beleidsstatus] || STATUS_LABELS.onbekend;
                    return (
                      <Badge variant="outline" className={`text-xs ${s.color}`}>
                        {s.label}
                      </Badge>
                    );
                  })()}
                </div>
                <div className="bg-card rounded-md border p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
                    <Ruler size={12} />
                    Afstand
                  </div>
                  <p className="text-sm font-medium">{summary.afstandscriterium}</p>
                </div>
              </div>

              {summary.samenvatting && summary.samenvatting !== "onbekend" && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {summary.samenvatting}
                </p>
              )}

              {summary.bronnen?.length > 0 && (
                <p className="text-[10px] text-muted-foreground/70">
                  Gebaseerd op: {summary.bronnen.slice(0, 3).join(", ")}
                </p>
              )}
            </div>
          )}

          {summaryError && !isSummarizing && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {summaryError}
            </div>
          )}

          {/* Search bar */}
          <div className="flex gap-2">
            <Input
              value={zoektermen}
              onChange={(e) => setZoektermen(e.target.value)}
              placeholder="Zoektermen..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button
              onClick={handleSearch}
              disabled={isSearching}
              size="sm"
              variant="outline"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">Zoeken</span>
            </Button>
          </div>

          {/* Loading state */}
          {isSearching && !hasSearched && (
            <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Publicaties ophalen voor {gemeentenaam}...
            </div>
          )}

          {/* No results */}
          {hasSearched && documents.length === 0 && !isSearching && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                Geen documenten gevonden voor "{gemeentenaam}". Niet alle gemeenten zijn beschikbaar in Open Raadsinformatie.
              </span>
            </div>
          )}

          {/* Results */}
          {documents.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {total} documenten gevonden · Top {documents.length} getoond
              </p>

              <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                {documents.map((doc) => {
                  const sourceBadge = SOURCE_BADGES[doc.source || ""];

                  return (
                    <div
                      key={doc.id}
                      className="border rounded-lg p-3 text-sm hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground line-clamp-2">{doc.name}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {doc.date && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(doc.date).toLocaleDateString("nl-NL")}
                                </span>
                              )}
                              {sourceBadge && (
                                <Badge variant="outline" className={`text-[10px] px-1 py-0 h-3.5 font-normal ${sourceBadge.className}`}>
                                  {sourceBadge.label}
                                </Badge>
                              )}
                              {doc.description && (
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {doc.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {doc.url && (
                          <Button variant="ghost" size="sm" className="h-7 px-2 shrink-0" asChild>
                            <a href={doc.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
