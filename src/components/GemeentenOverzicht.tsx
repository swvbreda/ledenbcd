import type { Member } from "@/data/types";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import coffeeshopData from "@/data/coffeeshops-nl.json";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useMergedMembers } from "@/hooks/useMemberEdits";
import { getGemeente, aggregateByGemeente } from "@/data/gemeenteMapping";
import { pctColor } from "@/lib/pctColor";

const perStad = aggregateByGemeente(coffeeshopData.perStad as Record<string, number>);
const totalNL = coffeeshopData.totaalNL;


const MiniDonut = ({ pct, size = 64, strokeWidth = 6 }: { pct: number; size?: number; strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (pct / 100) * circumference;
  const gap = circumference - filled;
  const center = size / 2;

  return (
    <svg width={size} height={size} className="block" style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={strokeWidth}
      />
      {pct > 0 && (
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={pctColor(pct)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${gap}`}
        />
      )}
    </svg>
  );
};

const EXPERIMENT_GEMEENTEN = [
  "Arnhem", "Breda", "Groningen", "Heerlen", "Voorne aan Zee",
  "Maastricht", "Nijmegen", "Tilburg", "Zaanstad", "Almere",
];

/** Check if a member/location belongs to a gemeente */
const isInGemeente = (m: Member, gemeente: string): boolean => {
  if (getGemeente(m.plaats) === gemeente) return true;
  return m.locaties?.some((l) => getGemeente(l.plaats || m.plaats) === gemeente) || false;
};

const GemeentenOverzicht = ({ members }: { members: Member[] }) => {
  const navigate = useNavigate();
  const { rawLeads } = useMembersData();
  const { members: mergedLeads } = useMergedMembers(rawLeads);
  // Use merged members + merged leads for market share calculations
  const represented = [...members, ...mergedLeads];
  const totalLocaties = represented.reduce((s, m) => s + (m.locaties?.length || m.aantalLocaties || 1), 0);

  // Count represented locations per city (members + leads)
  const cityCount: Record<string, number> = {};
  const cityMembers: Record<string, number> = {};
  represented.forEach((m) => {
    if (m.plaats) {
      cityCount[m.plaats] = (cityCount[m.plaats] || 0) + (m.aantalLocaties || 1);
      cityMembers[m.plaats] = (cityMembers[m.plaats] || 0) + 1;
    }
  });

  const marketPct = Math.round((totalLocaties / totalNL) * 100);

  // Curated list: G4, provincial capitals, and key cities
  const featuredCities = [
    "Amsterdam", "Rotterdam", "Den Haag", "Utrecht", // G4
    "Arnhem", "Enschede", "Zwolle", "Apeldoorn", // Oost
    "Eindhoven", "Haarlem", "Hilversum", // Overig
  ];

  const topCities = featuredCities
    .filter((city) => perStad[city]) // only cities in national data
    .map((city) => {
      const total = perStad[city] || 0;
      const bcd = cityCount[city] || 0;
      const leden = cityMembers[city] || 0;
      const pct = total > 0 ? Math.round((bcd / total) * 100) : 0;
      return { city, total, bcd, leden, pct };
    });

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left: Landelijk + Donuts */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold font-display mb-1">Vertegenwoordiging per gemeente</h3>
              <p className="text-xs text-muted-foreground">
                Vertegenwoordiging t.o.v. totaal per gemeente
              </p>
            </div>
            <button
              onClick={() => navigate("/locaties")}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium shrink-0"
            >
              Volledig overzicht <ArrowRight size={12} />
            </button>
          </div>

          {/* Landelijk overview */}
          <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
            <MiniDonut pct={marketPct} size={56} strokeWidth={5} />
            <div>
              <p className="text-sm font-semibold font-display">Landelijk: {marketPct}%</p>
              <p className="text-xs text-muted-foreground">{totalLocaties} van {totalNL} coffeeshops</p>
            </div>
          </div>

          {/* Donut grid for top cities */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
            {topCities.map(({ city, total, bcd, pct }) => (
              <div key={city} className="flex flex-col items-center text-center gap-1.5 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                <div className="relative">
                  <MiniDonut pct={pct} size={52} strokeWidth={5} />
                  <span className="absolute inset-0 flex items-center justify-center text-xs font-bold font-display">
                    {pct}%
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium leading-tight">{city}</p>
                  <p className="text-[10px] text-muted-foreground tabular-nums">{bcd}/{total}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Experiment table */}
        <div>
          <h3 className="text-sm font-semibold font-display mb-1">Experiment gemeenten</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Aangesloten leden in de 10 experiment-gemeenten
          </p>
          <div className="space-y-1">
            {EXPERIMENT_GEMEENTEN.map((gemeente) => {
              const leden = represented.filter((m) => isInGemeente(m, gemeente));
              const locs = leden.reduce((s, m) => {
                const mainMatch = getGemeente(m.plaats) === gemeente;
                if (mainMatch && (!m.locaties || m.locaties.length === 0)) return s + (m.aantalLocaties || 1);
                return s + (m.locaties?.filter((l) => getGemeente(l.plaats || m.plaats) === gemeente).length || 0);
              }, 0);
              const total = perStad[gemeente] || 0;
              const hasBcd = leden.length > 0;

              return (
                <div
                  key={gemeente}
                  className={`flex items-center justify-between text-sm px-3 py-1.5 rounded ${
                    hasBcd ? "bg-success/10" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${hasBcd ? "bg-success" : "bg-muted-foreground/30"}`} />
                    <span className={hasBcd ? "font-medium" : "text-muted-foreground"}>{gemeente}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasBcd ? (
                      <span className="text-xs tabular-nums">
                        <span className="font-medium">{leden.length}</span>
                        <span className="text-muted-foreground"> leden</span>
                        {total > 0 && (
                          <span className="text-muted-foreground ml-1">· {locs}/{total}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 px-3 py-2 bg-muted/30 rounded text-xs text-muted-foreground">
            In{" "}
            <span className="font-medium text-foreground">
              {EXPERIMENT_GEMEENTEN.filter((g) => represented.some((m) => isInGemeente(m, g))).length}/10
            </span>
            {" "}gemeenten vertegenwoordigd binnen het experiment
          </div>
        </div>
      </div>
    </div>
  );
};

export default GemeentenOverzicht;
