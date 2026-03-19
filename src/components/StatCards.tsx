import { useNavigate } from "react-router-dom";
import { Users, Building2, MapPin, PieChart } from "lucide-react";
import type { Member } from "@/data/types";
import coffeeshopData from "@/data/coffeeshops-nl.json";
import { allRepresented, allLeads } from "@/hooks/useMembers";
import { aggregateByGemeente, getGemeente } from "@/data/gemeenteMapping";

interface StatCardsProps {
  members: Member[];
}

const StatCards = ({ members }: StatCardsProps) => {
  const navigate = useNavigate();

  const totalMembers = members.length;
  const totalLocations = members.reduce((sum, m) => sum + m.aantalLocaties, 0);
  const allCities = new Set(members.map((m) => m.plaats).filter(Boolean));
  const perStad = aggregateByGemeente(coffeeshopData.perStad as Record<string, number>);
  const totalNLCities = Object.keys(perStad).length;
  const matchedCities = [...allCities].filter((c) => c in perStad).length;
  const uniqueCities = allCities.size;
  const cityPct = Math.round((matchedCities / totalNLCities) * 100);
  const totalNL = coffeeshopData.totaalNL;
  const representedLocations = allRepresented.reduce((sum, m) => sum + m.aantalLocaties, 0);
  const marketPct = Math.round((representedLocations / totalNL) * 100);
  const g4Cities = ["Amsterdam", "Rotterdam", "Den Haag", "Utrecht"];
  const g4Total = g4Cities.reduce((s, c) => s + (perStad[c] || 0), 0);
  const repCityCount: Record<string, number> = {};
  allRepresented.forEach((m) => {
    if (m.plaats) repCityCount[m.plaats] = (repCityCount[m.plaats] || 0) + (m.aantalLocaties || 1);
  });
  const g4Bcd = g4Cities.reduce((s, c) => s + (repCityCount[c] || 0), 0);
  const g4Pct = g4Total > 0 ? Math.round((g4Bcd / g4Total) * 100) : 0;

  const MiniGauge = ({ pct, color }: { pct: number; color: string }) => {
    const radius = 28;
    const stroke = 5;
    const circumference = Math.PI * radius;
    const filled = (pct / 100) * circumference;
    return (
      <svg width="70" height="42" viewBox="0 0 70 42" className="mx-auto">
        <path
          d="M 7 38 A 28 28 0 0 1 63 38"
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d="M 7 38 A 28 28 0 0 1 63 38"
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
    );
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Aangesloten Coffeeshops */}
      <div className="bg-card rounded-lg border border-border p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Vertegenwoordigde Coffeeshops</p>
          <Users size={18} className="text-primary" />
        </div>
        <p className="text-xl sm:text-2xl font-bold font-display mt-1.5">{representedLocations}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{totalMembers} leden · {allLeads.length} leads</p>
      </div>

      {/* Gemeenten */}
      <div
        className="bg-card rounded-lg border border-border p-4 sm:p-5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => navigate("/locaties")}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Gemeenten</p>
          <Building2 size={18} className="text-primary" />
        </div>
        <p className="text-xl sm:text-2xl font-bold font-display mt-1.5">{matchedCities}</p>
        <p className="text-xs text-muted-foreground mt-0.5">van {totalNLCities} coffeeshopgemeenten</p>
      </div>

      {/* Marktaandeel gauge */}
      <div
        className="bg-card rounded-lg border border-border p-4 sm:p-5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => navigate("/locaties")}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Marktaandeel</p>
          <PieChart size={18} className="text-primary" />
        </div>
        <div className="mt-1">
          <MiniGauge pct={marketPct} color="hsl(var(--success))" />
          <p className="text-center text-lg sm:text-xl font-bold font-display -mt-1">{marketPct}%</p>
          <p className="text-xs text-muted-foreground text-center">{representedLocations}/{totalNL} coffeeshops</p>
        </div>
      </div>

      {/* G4 dekking */}
      <div
        className="bg-card rounded-lg border border-border p-4 sm:p-5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => navigate("/locaties")}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">G4 dekking</p>
          <MapPin size={18} className="text-success" />
        </div>
        <div className="mt-1">
          <MiniGauge pct={g4Pct} color="hsl(var(--success))" />
          <p className="text-center text-lg sm:text-xl font-bold font-display -mt-1">{g4Pct}%</p>
          <p className="text-xs text-muted-foreground text-center">{g4Bcd}/{g4Total} coffeeshops</p>
        </div>
      </div>
    </div>
  );
};

export default StatCards;
