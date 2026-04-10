import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, FileText, Loader2, ExternalLink,
  AlertCircle, Notebook,
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
  lokaleregelgeving: { label: "Lokale Regelgeving", className: "text-green-700 border-green-300 bg-green-50" },
  officielebekendmakingen: { label: "Officiële Bekendmaking", className: "text-blue-700 border-blue-300 bg-blue-50" },
  raadzaam: { label: "Raadzaam", className: "text-indigo-700 border-indigo-300 bg-indigo-50" },
  notubiz: { label: "Notubiz", className: "text-orange-700 border-orange-300 bg-orange-50" },
  ori: { label: "Open Raadsinformatie", className: "text-muted-foreground border-border" },
};

export default function DocumentenZoeker() {
  const [zoektermen, setZoektermen] = useState("");
  const [documents, setDocuments] = useState<MunicipalDocument[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const handleSearch = useCallback(async () => {
    if (!zoektermen.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setShowAll(false);

    try {
      const { data, error } = await supabase.functions.invoke("search-municipal-docs", {
        body: { crossMunicipal: true, keywords: zoektermen },
      });
      if (error) throw error;

      const docs = (data.documents || []).filter((doc: MunicipalDocument) => doc.url);
      setDocuments(docs);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  }, [zoektermen]);

  const visibleDocs = showAll ? documents : documents.slice(0, 8);

  // Extract gemeente from organization string like "Gemeente Haarlem" -> "Haarlem"
  const getGemeenteLabel = (org: string) => {
    return org.replace(/^gemeente\s+/i, "").trim() || org;
  };

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Notebook size={16} className="text-primary" />
          <h3 className="text-sm font-semibold font-display">Zoeken in beleidsdocumenten</h3>
        </div>

        <p className="text-xs text-muted-foreground">
          Zoek in coffeeshopbeleid, raadsstukken en regelgeving van alle gemeenten tegelijk.
        </p>

        <div className="flex gap-2">
          <Input
            value={zoektermen}
            onChange={(e) => setZoektermen(e.target.value)}
            placeholder="Bijv. i-criterium, damoclesbeleid, gedoogverklaring..."
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button
            onClick={handleSearch}
            disabled={isSearching || !zoektermen.trim()}
            size="sm"
            variant="outline"
          >
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            <span className="ml-1 hidden sm:inline">Zoeken</span>
          </Button>
        </div>

        {isSearching && (
          <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Documenten zoeken...
          </div>
        )}

        {hasSearched && documents.length === 0 && !isSearching && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Geen documenten gevonden voor "{zoektermen}".</span>
          </div>
        )}

        {visibleDocs.length > 0 && (
          <div className="space-y-2">
            <div className="space-y-1.5">
              {visibleDocs.map((doc) => {
                const sourceBadge = SOURCE_BADGES[doc.source || ""];
                const gemeente = getGemeenteLabel(doc.organization);

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
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-medium bg-primary/5 text-primary border-primary/20">
                              {gemeente}
                            </Badge>
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
                          </div>
                        </div>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </a>
                );
              })}
            </div>

            {!showAll && documents.length > 8 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowAll(true)}
              >
                Bekijk meer ({documents.length - 8} overige documenten)
              </Button>
            )}

            {showAll && documents.length > 8 && (
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
    </div>
  );
}
