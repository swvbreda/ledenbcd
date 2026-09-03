import { useState } from "react";
import type { Member } from "@/data/types";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useMergedMembers } from "@/hooks/useMemberEdits";
import { ArrowLeft, ExternalLink, Search } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { useRegisterStats } from "@/hooks/useRegisterStats";



const MarktaandeelPage = () => {
  const navigate = useNavigate();
  const { allRepresented } = useMembersData();
  const { members: represented } = useMergedMembers(allRepresented);
  const {
    perGemeente: perStad,
    totaalNL: totalNL,
    representedPerGemeente: cityCount,
    totaalRepresented: totalLocaties,
  } = useRegisterStats();
  const [expandedCity, setExpandedCity] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Group members + leads by city for representation
  const representedByCity: Record<string, Member[]> = {};
  represented.forEach((m) => {
    if (m.plaats) {
      if (!representedByCity[m.plaats]) representedByCity[m.plaats] = [];
      representedByCity[m.plaats].push(m);
    }
  });


  // All cities from NL data, enriched with BCD data
  const allCities = Object.entries(perStad)
    .map(([city, total]) => {
      const bcd = cityCount[city] || 0;
      const pct = total > 0 ? Math.round((bcd / total) * 100) : 0;
      return { city, total, bcd, pct };
    })
    .sort((a, b) => b.total - a.total);

  // Cities where BCD has members but not in NL data
  const extraCities = Object.entries(cityCount)
    .filter(([city]) => !perStad[city])
    .map(([city, bcd]) => ({ city, total: 0, bcd, pct: 0 }))
    .sort((a, b) => b.bcd - a.bcd);

  const marketPct = totalNL > 0 ? Math.round((totalLocaties / totalNL) * 100) : 0;

  // G4 stats
  const g4Cities = ["Amsterdam", "Rotterdam", "Den Haag", "Utrecht"];
  const g4Total = g4Cities.reduce((s, c) => s + (perStad[c] || 0), 0);
  const g4Bcd = g4Cities.reduce((s, c) => s + (cityCount[c] || 0), 0);
  const g4Pct = g4Total > 0 ? Math.round((g4Bcd / g4Total) * 100) : 0;

  const toggleCity = (city: string) => {
    setExpandedCity(expandedCity === city ? null : city);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
        >
          <ArrowLeft size={14} /> Terug
        </button>
        <h2 className="text-xl sm:text-2xl font-bold font-display">Vertegenwoordiging BCD</h2>
        <p className="text-sm text-muted-foreground mt-1">
          BCD-locaties t.o.v. het totaal aantal coffeeshops per stad
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Coffeeshops NL", value: totalNL },
          { label: "Aangesloten", value: totalLocaties },
          { label: "Vertegenwoordiging", value: `${marketPct}%` },
          { label: "G4 dekking", value: `${g4Pct}%`, sub: `${g4Bcd}/${g4Total}` },
        ].map((card) => (
          <div key={card.label} className="bg-card rounded-lg border border-border p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
            <p className="text-2xl font-bold font-display">{card.value}</p>
            {card.sub && <p className="text-xs text-muted-foreground">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Search + Full table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Zoek een stad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/50 border border-border rounded-md focus:outline-hidden focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-3 py-2 font-medium w-[30%]">Stad</th>
                <th className="text-right px-3 py-2 font-medium w-[15%]">Totaal</th>
                <th className="text-right px-3 py-2 font-medium w-[15%]">BCD</th>
                <th className="text-right px-3 py-2 font-medium w-[10%]">%</th>
                <th className="px-3 py-2 w-[30%]"></th>
              </tr>
            </thead>
            <tbody>
              {allCities.filter(({ city }) => city.toLowerCase().includes(search.toLowerCase())).map(({ city, total, bcd, pct }) => {
                const cityEntries = representedByCity[city] || [];
                const isExpanded = expandedCity === city;
                return (
                  <>
                    <tr
                      key={city}
                      className={`border-b border-border/50 transition-colors ${
                        cityEntries.length > 0 ? "cursor-pointer hover:bg-muted/30" : ""
                      } ${isExpanded ? "bg-muted/20" : ""}`}
                      onClick={() => cityEntries.length > 0 && toggleCity(city)}
                    >
                      <td className="px-3 py-1.5 font-medium truncate">
                        <span>{city}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/coffeeshopregister/gemeente/${encodeURIComponent(city)}`);
                          }}
                          className="ml-2 text-xs text-primary hover:underline"
                          title="Bekijk registerdetails"
                        >
                          register
                        </button>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{total}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{bcd}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        <span className={pct >= 30 ? "text-success font-medium" : pct > 0 ? "text-foreground" : "text-muted-foreground"}>
                          {pct}%
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct >= 30 ? "bg-success" : "bg-primary/60"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                    {isExpanded && cityEntries.map((m) => (
                      <tr
                        key={`${city}-${m.id}`}
                        className="border-b border-border/30 bg-muted/10 hover:bg-muted/20 cursor-pointer transition-colors"
                        onClick={(e) => { e.stopPropagation(); navigate(`/leden/${m.id}`); }}
                      >
                        <td className="px-3 py-1.5 pl-9 text-muted-foreground" colSpan={2}>
                          <span className="inline-flex items-center gap-2">
                            <span className="text-xs tabular-nums text-muted-foreground/60">#{m.id}</span>
                            <span className="font-medium text-foreground">{m.naam}</span>
                            {(m.aantalLocaties || 1) > 1 && (
                              <span className="text-xs text-muted-foreground">({m.aantalLocaties} locaties)</span>
                            )}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{m.aantalLocaties || 1}</td>
                        <td className="px-3 py-1.5" />
                        <td className="px-3 py-1.5">
                          <ExternalLink size={12} className="text-muted-foreground/40" />
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extra cities with BCD members but no NL data */}
      {extraCities.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-5">
          <h3 className="text-sm font-semibold font-display mb-1">
            Steden met aangesloten leden (niet in landelijke data)
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Deze steden staan niet in de landelijke adressenlijst maar hebben wel aangesloten leden
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {extraCities.map(({ city, bcd }) => (
              <div
                key={city}
                className="flex items-center justify-between text-sm px-3 py-1.5 bg-muted/50 rounded-sm cursor-pointer hover:bg-muted/70 transition-colors"
                onClick={() => toggleCity(expandedCity === city ? "" : city)}
              >
                <span className="text-muted-foreground">{city}</span>
                <span className="font-medium tabular-nums">{bcd}</span>
              </div>
            ))}
          </div>
          {expandedCity && representedByCity[expandedCity] && !perStad[expandedCity] && (
            <div className="mt-3 bg-card rounded-sm border border-border/50 divide-y divide-border/30">
              {representedByCity[expandedCity].map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => navigate(`/leden/${m.id}`)}
                >
                  <span className="text-xs tabular-nums text-muted-foreground/60">#{m.id}</span>
                  <span className="font-medium">{m.naam}</span>
                  {(m.aantalLocaties || 1) > 1 && (
                    <span className="text-xs text-muted-foreground">({m.aantalLocaties} locaties)</span>
                  )}
                  <ExternalLink size={12} className="ml-auto text-muted-foreground/40" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MarktaandeelPage;
