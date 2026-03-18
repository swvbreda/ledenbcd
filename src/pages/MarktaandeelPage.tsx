import type { Member } from "@/data/types";
import { allMembers } from "@/hooks/useMembers";
import coffeeshopData from "@/data/coffeeshops-nl.json";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const perStad = coffeeshopData.perStad as Record<string, number>;
const totalNL = coffeeshopData.totaalNL;

const MarktaandeelPage = () => {
  const navigate = useNavigate();
  const members = allMembers;
  const totalMembers = members.length;
  const totalLocaties = members.reduce((s, m) => s + (m.aantalLocaties || 1), 0);

  // Count BCD locations per city
  const cityCount: Record<string, number> = {};
  members.forEach((m) => {
    if (m.plaats) cityCount[m.plaats] = (cityCount[m.plaats] || 0) + (m.aantalLocaties || 1);
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

  const marketPct = Math.round((totalLocaties / totalNL) * 100);

  // G4 stats
  const g4Cities = ["Amsterdam", "Rotterdam", "Den Haag", "Utrecht"];
  const g4Total = g4Cities.reduce((s, c) => s + (perStad[c] || 0), 0);
  const g4Bcd = g4Cities.reduce((s, c) => s + (cityCount[c] || 0), 0);
  const g4Pct = g4Total > 0 ? Math.round((g4Bcd / g4Total) * 100) : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
        >
          <ArrowLeft size={14} /> Terug
        </button>
        <h2 className="text-xl sm:text-2xl font-bold font-display">Marktaandeel BCD</h2>
        <p className="text-sm text-muted-foreground mt-1">
          BCD-leden t.o.v. het totaal aantal coffeeshops per stad · bron: WODC 2024
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Coffeeshops NL", value: totalNL },
          { label: "BCD-leden", value: totalMembers },
          { label: "Marktaandeel", value: `${marketPct}%` },
          { label: "G4 dekking", value: `${g4Pct}%`, sub: `${g4Bcd}/${g4Total}` },
        ].map((card) => (
          <div key={card.label} className="bg-card rounded-lg border border-border p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
            <p className="text-2xl font-bold font-display">{card.value}</p>
            {card.sub && <p className="text-xs text-muted-foreground">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Full table */}
      <div className="bg-card rounded-lg border border-border overflow-hidden">
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
              {allCities.map(({ city, total, bcd, pct }) => (
                <tr key={city} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-1.5 font-medium truncate">{city}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extra cities with BCD members but no NL data */}
      {extraCities.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-5">
          <h3 className="text-sm font-semibold font-display mb-1">
            Steden met BCD-leden (niet in WODC-data)
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Deze steden staan niet in de WODC-monitor maar hebben wel BCD-leden
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {extraCities.map(({ city, bcd }) => (
              <div key={city} className="flex items-center justify-between text-sm px-3 py-1.5 bg-muted/50 rounded">
                <span className="text-muted-foreground">{city}</span>
                <span className="font-medium tabular-nums">{bcd}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MarktaandeelPage;
