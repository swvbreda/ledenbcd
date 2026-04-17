import { useState, useCallback, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, FileText, Loader2, ExternalLink,
  ChevronDown, ChevronUp, AlertCircle, Notebook,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth } from "@/lib/invokeFunction";

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

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  lokaleregelgeving: { label: "Lokale Regelgeving", className: "text-green-700 border-green-300 bg-green-50" },
  raadzaam: { label: "Raadzaam", className: "text-indigo-700 border-indigo-300 bg-indigo-50" },
  officielebekendmakingen: { label: "Officiële Bekendmaking", className: "text-blue-700 border-blue-300 bg-blue-50" },
  notubiz: { label: "Notubiz", className: "text-orange-700 border-orange-300 bg-orange-50" },
  parlaeus: { label: "Parlaeus", className: "text-teal-700 border-teal-300 bg-teal-50" },
  ori: { label: "Open Raadsinformatie", className: "text-muted-foreground border-border" },
};

interface GemeentePublicatiesProps {
  gemeentenaam: string;
}

export default function GemeentePublicaties({ gemeentenaam }: GemeentePublicatiesProps) {
  const [zoektermen, setZoektermen] = useState("");
  const [documents, setDocuments] = useState<MunicipalDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const autoSearchDone = useRef<string | null>(null);

  const handleSearch = useCallback(async (keywords?: string) => {
    if (!gemeentenaam.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setShowAll(false);

    try {
      const { data, error } = await invokeWithAuth("search-municipal-docs", {
        body: { gemeentenaam, keywords: keywords ?? (zoektermen || "coffeeshop beleid") },
      });
      if (error) throw error;

      // Filter: alleen documenten van deze gemeente + alleen met URL
      const gemeenteDocs = (data.documents || [])
        .filter((doc: MunicipalDocument) => {
          if (!doc.url) return false;
          const org = (doc.organization || "").toLowerCase().trim();
          const naam = gemeentenaam.toLowerCase().trim();
          // Strict match: org must be exactly the gemeente name or "gemeente X"
          return org === naam || org === `gemeente ${naam}`;
        })
        .sort((a: MunicipalDocument, b: MunicipalDocument) => {
          // Docs with dates first (newest first), then docs without dates
          const da = a.date ? new Date(a.date).getTime() : 0;
          const db = b.date ? new Date(b.date).getTime() : 0;
          if (da && db) return db - da;
          if (da && !db) return -1;
          if (!da && db) return 1;
          return 0;
        });

      setDocuments(gemeenteDocs);
      setTotal(gemeenteDocs.length);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  }, [gemeentenaam, zoektermen]);

  useEffect(() => {
    if (!gemeentenaam.trim() || gemeentenaam.trim().length < 3) return;
    if (autoSearchDone.current === gemeentenaam) return;
    const timer = setTimeout(() => {
      autoSearchDone.current = gemeentenaam;
      handleSearch("coffeeshop beleid");
    }, 400);
    return () => clearTimeout(timer);
  }, [gemeentenaam, handleSearch]);

  const visibleDocs = showAll ? documents : documents.slice(0, 5);

  return (
    <div className="bg-card rounded-lg border border-border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <h3 className="text-sm font-semibold font-display flex items-center gap-2">
          <Notebook size={16} className="text-primary" />
          Beleid- &amp; raadsdocumenten
          {isSearching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </h3>
        <span className="flex items-center gap-2">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          <div className="flex gap-2">
            <Input
              value={zoektermen}
              onChange={(e) => setZoektermen(e.target.value)}
              placeholder="Zoeken..."
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button
              onClick={() => handleSearch()}
              disabled={isSearching}
              size="sm"
              variant="outline"
            >
              {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">Zoeken</span>
            </Button>
          </div>

          {isSearching && !hasSearched && (
            <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Documenten ophalen voor {gemeentenaam}...
            </div>
          )}

          {hasSearched && documents.length === 0 && !isSearching && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>
                Geen documenten gevonden voor "{gemeentenaam}".
              </span>
            </div>
          )}

          {visibleDocs.length > 0 && (
            <div className="space-y-2">
              <div className="space-y-1.5">
                {visibleDocs.map((doc) => {
                  const sourceBadge = SOURCE_BADGES[doc.source || ""];

                  return (
                    <a
                      key={doc.id}
                      href={doc.url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border rounded-lg p-3 text-sm hover:bg-muted/30 transition-colors block cursor-pointer group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                              {doc.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {doc.date ? (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(doc.date).toLocaleDateString("nl-NL")}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">
                                  Datum onbekend
                                </span>
                              )}
                              {sourceBadge && (
                                <Badge variant="outline" className={`text-[10px] px-1 py-0 h-3.5 font-normal ${sourceBadge.className}`}>
                                  {sourceBadge.label}
                                </Badge>
                              )}
                              {doc.description && (
                                <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                                  {doc.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </a>
                  );
                })}
              </div>

              {!showAll && documents.length > 5 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowAll(true)}
                >
                  Bekijk meer ({documents.length - 5} overige documenten)
                </Button>
              )}

              {showAll && documents.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => setShowAll(false)}
                >
                  Minder tonen
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
