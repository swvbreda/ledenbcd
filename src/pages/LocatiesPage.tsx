import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, MapPin, Users, Building2, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { allMembers, allRepresented } from "@/hooks/useMembers";
import CityMap from "@/components/CityMap";
import coffeeshopData from "@/data/coffeeshops-nl.json";

const perStad = coffeeshopData.perStad as Record<string, number>;
const totalNL = coffeeshopData.totaalNL;

interface CityData {
  naam: string;
  aantalLeden: number;
  aantalLocaties: number;
  leden: { id: number; naam: string; aantalLocaties: number }[];
  totaalNL: number;
  marktPct: number;
}

class MapErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Locatieskaart kon niet worden geladen", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-card rounded-lg border border-border p-4 text-sm text-muted-foreground">
          De kaart is tijdelijk niet beschikbaar, maar alle steden en locaties staan hieronder in de tabel.
        </div>
      );
    }
    return this.props.children;
  }
}

const LocatiesPage = () => {
  const [search, setSearch] = useState("");
  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"naam" | "aantalLeden" | "aantalLocaties" | "marktPct">("aantalLeden");
  const [sortAsc, setSortAsc] = useState(false);
  const navigate = useNavigate();

  // Use allRepresented for market share counting
  const represented = allRepresented;
  const representedLocaties = represented.reduce((s, m) => s + (m.aantalLocaties || 1), 0);
  const marketPctNL = Math.round((representedLocaties / totalNL) * 100);

  // Count represented locations per city
  const repCityCount: Record<string, number> = {};
  represented.forEach((m) => {
    if (m.plaats) repCityCount[m.plaats] = (repCityCount[m.plaats] || 0) + (m.aantalLocaties || 1);
  });

  // G4 stats
  const g4Cities = ["Amsterdam", "Rotterdam", "Den Haag", "Utrecht"];
  const g4Total = g4Cities.reduce((s, c) => s + (perStad[c] || 0), 0);
  const g4Bcd = g4Cities.reduce((s, c) => s + (repCityCount[c] || 0), 0);
  const g4Pct = g4Total > 0 ? Math.round((g4Bcd / g4Total) * 100) : 0;

  const cities = useMemo(() => {
    const map = new Map<string, CityData>();

    for (const m of allMembers) {
      for (const l of m.locaties) {
        const plaats = l.plaats || m.plaats;
        if (!plaats) continue;

        if (!map.has(plaats)) {
          const totaal = perStad[plaats] || 0;
          const bcd = repCityCount[plaats] || 0;
          map.set(plaats, {
            naam: plaats,
            aantalLeden: 0,
            aantalLocaties: 0,
            stadsdelen: [],
            leden: [],
            totaalNL: totaal,
            marktPct: totaal > 0 ? Math.round((bcd / totaal) * 100) : 0,
          });
        }
        const city = map.get(plaats)!;
        city.aantalLocaties++;

        if (!city.leden.some((x) => x.id === m.id)) {
          city.aantalLeden++;
          city.leden.push({ id: m.id, naam: m.naam, aantalLocaties: m.locaties.filter((loc) => (loc.plaats || m.plaats) === plaats).length });
        }

        if (l.stadsdeel && !city.stadsdelen.includes(l.stadsdeel)) {
          city.stadsdelen.push(l.stadsdeel);
        }
      }
    }

    // Add cities that only have leads (not in allMembers)
    for (const [plaats, count] of Object.entries(repCityCount)) {
      if (!map.has(plaats)) {
        const totaal = perStad[plaats] || 0;
        map.set(plaats, {
          naam: plaats,
          aantalLeden: 0,
          aantalLocaties: count,
          stadsdelen: [],
          leden: [],
          totaalNL: totaal,
          marktPct: totaal > 0 ? Math.round((count / totaal) * 100) : 0,
        });
      }
    }

    return Array.from(map.values());
  }, []);

  const filtered = useMemo(() => {
    let result = cities;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.naam.toLowerCase().includes(q) || c.stadsdelen.some((s) => s.toLowerCase().includes(q)));
    }
    return [...result].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "string" && typeof bv === "string") {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
  }, [cities, search, sortKey, sortAsc]);

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "naam");
    }
  };

  const SortIcon = ({ col }: { col: typeof sortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const totalLocations = cities.reduce((s, c) => s + c.aantalLocaties, 0);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display">Gemeenten & Marktaandeel</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} steden · {totalLocations} locaties · bron: WODC 2024
          </p>
        </div>
        <div className="relative max-w-sm w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Zoek stad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Coffeeshops NL", value: totalNL },
          { label: "Vertegenwoordigd", value: representedLocaties },
          { label: "Marktaandeel", value: `${marketPctNL}%` },
          { label: "G4 dekking", value: `${g4Pct}%`, sub: `${g4Bcd}/${g4Total}` },
        ].map((card) => (
          <div key={card.label} className="bg-card rounded-lg border border-border p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
            <p className="text-2xl font-bold font-display">{card.value}</p>
            {card.sub && <p className="text-xs text-muted-foreground">{card.sub}</p>}
          </div>
        ))}
      </div>

      <MapErrorBoundary>
        <CityMap cities={filtered} onCityClick={(name) => setExpandedCity(expandedCity === name ? null : name)} />
      </MapErrorBoundary>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort("naam")}>
                  <span className="inline-flex items-center gap-1">Stad <SortIcon col="naam" /></span>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors w-28" onClick={() => handleSort("aantalLeden")}>
                  <span className="inline-flex items-center gap-1">Leden <SortIcon col="aantalLeden" /></span>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors w-28" onClick={() => handleSort("aantalLocaties")}>
                  <span className="inline-flex items-center gap-1">BCD <SortIcon col="aantalLocaties" /></span>
                </th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground w-20">Totaal</th>
                <th className="px-4 py-3 text-center font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors w-28" onClick={() => handleSort("marktPct")}>
                  <span className="inline-flex items-center gap-1">Aandeel <SortIcon col="marktPct" /></span>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Stadsdelen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((city) => (
                <React.Fragment key={city.naam}>
                  <tr
                    className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedCity(expandedCity === city.naam ? null : city.naam)}
                  >
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 font-medium font-display">
                        <MapPin size={14} className="text-primary" />
                        {city.naam}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Users size={13} /> {city.aantalLeden}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">{city.aantalLocaties}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">{city.totaalNL || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      {city.totaalNL > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${city.marktPct >= 30 ? "bg-success" : "bg-primary/60"}`}
                              style={{ width: `${Math.min(city.marktPct, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs tabular-nums w-8 text-right ${city.marktPct >= 30 ? "text-success font-medium" : ""}`}>
                            {city.marktPct}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {city.stadsdelen.sort().map((sd) => (
                          <span key={sd} className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">{sd}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {expandedCity === city.naam && city.leden
                    .sort((a, b) => a.naam.localeCompare(b.naam))
                    .map((lid) => (
                      <tr
                        key={`${city.naam}-${lid.id}`}
                        className="border-b border-border bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer"
                        onClick={() => navigate(`/leden/${lid.id}`)}
                      >
                        <td className="pl-10 pr-4 py-2.5">
                          <span className="font-medium font-display text-sm">{lid.naam}</span>
                          {lid.aantalLocaties > 1 && (
                            <span className="text-xs text-muted-foreground ml-1.5">({lid.aantalLocaties} loc)</span>
                          )}
                        </td>
                        <td colSpan={4} />
                        <td className="px-4 py-2.5">
                          <ExternalLink size={12} className="text-muted-foreground/40" />
                        </td>
                      </tr>
                    ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LocatiesPage;