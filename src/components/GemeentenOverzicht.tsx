import type { Member } from "@/data/types";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import coffeeshopData from "@/data/coffeeshops-nl.json";

const perStad = coffeeshopData.perStad as Record<string, number>;
const totalNL = coffeeshopData.totaalNL;

const MiniDonut = ({ pct, size = 64, strokeWidth = 6 }: { pct: number; size?: number; strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (pct / 100) * circumference;
  const center = size / 2;

  return (
    <svg width={size} height={size} className="block">
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={pct >= 30 ? "hsl(var(--success))" : "hsl(var(--primary))"}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        strokeDashoffset={circumference * 0.25}
        transform={`rotate(-90 ${center} ${center})`}
      />
    </svg>
  );
};

const EXPERIMENT_GEMEENTEN = [
  "Arnhem", "Breda", "Groningen", "Heerlen", "Hellevoetsluis",
  "Maastricht", "Nijmegen", "Tilburg", "Zaanstad", "Almere",
];

const GemeentenOverzicht = ({ members }: { members: Member[] }) => {
  const navigate = useNavigate();
  const totalLocaties = members.reduce((s, m) => s + (m.aantalLocaties || 1), 0);

  // Count BCD locations per city
  const cityCount: Record<string, number> = {};
  const cityMembers: Record<string, number> = {};
  members.forEach((m) => {
    if (m.plaats) {
      cityCount[m.plaats] = (cityCount[m.plaats] || 0) + (m.aantalLocaties || 1);
      cityMembers[m.plaats] = (cityMembers[m.plaats] || 0) + 1;
    }
  });

  const marketPct = Math.round((totalLocaties / totalNL) * 100);

  // Top cities by total coffeeshops, with BCD data
  const topCities = Object.entries(perStad)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([city, total]) => {
      const bcd = cityCount[city] || 0;
      const leden = cityMembers[city] || 0;
      const pct = total > 0 ? Math.round((bcd / total) * 100) : 0;
      return { city, total, bcd, leden, pct };
    });

  return (
    <div className="bg-card rounded-lg border border-border p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold font-display mb-1">Gemeenten & Marktaandeel</h3>
          <p className="text-xs text-muted-foreground">
            BCD-coffeeshops t.o.v. totaal per gemeente · bron WODC 2024
          </p>
        </div>
        <button
          onClick={() => navigate("/marktaandeel")}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium shrink-0"
        >
          Volledig overzicht <ArrowRight size={12} />
        </button>
      </div>

      {/* Landelijk overview */}
      <div className="flex items-center gap-4 mb-5 p-3 bg-muted/30 rounded-lg">
        <MiniDonut pct={marketPct} size={56} strokeWidth={5} />
        <div>
          <p className="text-sm font-semibold font-display">Landelijk: {marketPct}%</p>
          <p className="text-xs text-muted-foreground">{totalLocaties} van {totalNL} coffeeshops</p>
        </div>
      </div>

      {/* Donut grid for top cities */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
  );
};

export default GemeentenOverzicht;
