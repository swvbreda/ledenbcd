import { useState, useCallback, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, FileText, Loader2, ExternalLink,
  ChevronDown, ChevronUp, AlertCircle, Notebook,
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

const SOURCE_BADGES: Record<string, { label: string; className: string }> = {
  lokaleregelgeving: { label: "Beleidsregel", className: "text-green-700 border-green-300 bg-green-50" },
  officielebekendmakingen: { label: "Officiële Bekendmaking", className: "text-purple-700 border-purple-300 bg-purple-50" },
  notubiz: { label: "Notubiz", className: "text-accent border-accent/30" },
  parlaeus: { label: "Parlaeus", className: "text-blue-700 border-blue-300 bg-blue-50" },
  ori: { label: "Open Raadsinformatie", className: "text-muted-foreground border-border" },
};

interface GemeentePublicatiesProps {
  gemeentenaam: string;
}

export default function GemeentePublicaties({ gemeentenaam }: GemeentePublicatiesProps) {
  const [zoektermen, setZoektermen] = useState("coffeeshop beleid");
  const [documents, setDocuments] = useState<MunicipalDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const autoSearchDone = useRef<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!gemeentenaam.trim()) return;
    setIsSearching(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase.functions.invoke("search-municipal-docs", {
        body: { gemeentenaam, keywords: zoektermen },
      });
      if (error) throw error;
      setDocuments(data.documents || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  }, [gemeentenaam, zoektermen]);

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
          Zoeken in beleid- &amp; raadsdocumenten
          {isSearching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </h3>
        <span className="flex items-center gap-2">
          {documents.length > 0 && (
            <Badge variant="outline" className="text-xs font-normal">
              {total} resultaten
            </Badge>
          )}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
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
                Geen documenten gevonden voor "{gemeentenaam}". Niet alle gemeenten zijn beschikbaar in Open Raadsinformatie.
              </span>
            </div>
          )}

          {documents.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {total} documenten gevonden
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
