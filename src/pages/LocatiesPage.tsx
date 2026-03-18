import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, MapPin, Users, Building2, ChevronDown, ChevronUp } from "lucide-react";
import { allMembers } from "@/hooks/useMembers";

interface CityData {
  naam: string;
  aantalLeden: number;
  aantalLocaties: number;
  stadsdelen: string[];
  leden: { id: number; naam: string; aantalLocaties: number }[];
}

const LocatiesPage = () => {
  const [search, setSearch] = useState("");
  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<"naam" | "aantalLeden" | "aantalLocaties">("aantalLeden");
  const [sortAsc, setSortAsc] = useState(false);
  const navigate = useNavigate();

  const cities = useMemo(() => {
    const map = new Map<string, CityData>();

    for (const m of allMembers) {
      for (const l of m.locaties) {
        const plaats = l.plaats || m.plaats;
        if (!plaats) continue;

        if (!map.has(plaats)) {
          map.set(plaats, { naam: plaats, aantalLeden: 0, aantalLocaties: 0, stadsdelen: [], leden: [] });
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
    else { setSortKey(key); setSortAsc(key === "naam"); }
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
          <h2 className="text-xl sm:text-2xl font-bold font-display">Steden</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} steden · {totalLocations} locaties
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
                  <span className="inline-flex items-center gap-1">Locaties <SortIcon col="aantalLocaties" /></span>
                </th>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Stadsdelen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((city) => (
                <>
                  <tr
                    key={city.naam}
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
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Building2 size={13} /> {city.aantalLocaties}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {city.stadsdelen.sort().map((sd) => (
                          <span key={sd} className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">{sd}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                  {expandedCity === city.naam && (
                    <tr key={`${city.naam}-detail`} className="border-b border-border bg-muted/10">
                      <td colSpan={4} className="px-4 py-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                          {city.leden
                            .sort((a, b) => a.naam.localeCompare(b.naam))
                            .map((lid) => (
                              <button
                                key={lid.id}
                                onClick={(e) => { e.stopPropagation(); navigate(`/leden/${lid.id}`); }}
                                className="text-left px-3 py-2 rounded border border-border bg-card hover:bg-muted/30 transition-colors text-sm"
                              >
                                <span className="font-medium font-display">{lid.naam}</span>
                                {lid.aantalLocaties > 1 && (
                                  <span className="text-xs text-muted-foreground ml-1">({lid.aantalLocaties} loc)</span>
                                )}
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LocatiesPage;
