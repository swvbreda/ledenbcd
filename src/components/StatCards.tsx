import { useNavigate } from "react-router-dom";
import { Users, Building2, MapPin, PieChart, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Member } from "@/data/types";
import coffeeshopData from "@/data/coffeeshops-nl.json";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useLeadConversions } from "@/hooks/useLeadConversions";
import { useMergedMembers } from "@/hooks/useMemberEdits";
import { aggregateByGemeente, getGemeente } from "@/data/gemeenteMapping";
import { pctColor } from "@/lib/pctColor";

interface StatCardsProps {
  members: Member[];
}

const StatCards = ({ members }: StatCardsProps) => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { rawLeads } = useMembersData();
  const { members: mergedMembers } = useMergedMembers(members);
  const { members: mergedLeads } = useMergedMembers(rawLeads);

  const { conversions } = useLeadConversions();
  const convertedLeadIds = new Set(conversions.map((c) => c.lead_id));
  const activeLeads = mergedLeads.filter((l) => !convertedLeadIds.has(l.id));
  const activeLeadsCount = activeLeads.length;

  // Build converted leads as members with merged edits
  const convertedAsMembers = conversions.map((conv) => {
    const originalLead = mergedLeads.find((l) => l.id === conv.lead_id);
    if (!originalLead) return null;
    return { ...originalLead, id: conv.lidnummer } as Member;
  }).filter(Boolean) as Member[];

  const totalMembers = mergedMembers.length + convertedAsMembers.length;

  // Use merged members + converted leads + active leads for all location/market calculations
  const allRepresented = [...mergedMembers, ...convertedAsMembers, ...activeLeads];
  const allCities = new Set(allRepresented.map((m) => m.plaats).filter(Boolean));
  const perStad = aggregateByGemeente(coffeeshopData.perStad as Record<string, number>);
  const totalNLCities = Object.keys(perStad).length;
  const representedGemeenten = new Set(allRepresented.map((m) => getGemeente(m.plaats)).filter((g) => g in perStad));
  const matchedCities = representedGemeenten.size;
  const cityPct = Math.round((matchedCities / totalNLCities) * 100);
  const totalNL = coffeeshopData.totaalNL;
  const representedLocations = allRepresented.reduce((sum, m) => sum + (m.locaties?.length || m.aantalLocaties), 0);
  const marketPct = Math.round((representedLocations / totalNL) * 100);
  const g4Cities = ["Amsterdam", "Rotterdam", "Den Haag", "Utrecht"];
  const g4Total = g4Cities.reduce((s, c) => s + (perStad[c] || 0), 0);
  const repCityCount: Record<string, number> = {};
  allRepresented.forEach((m) => {
    if (m.plaats) repCityCount[m.plaats] = (repCityCount[m.plaats] || 0) + (m.locaties?.length || m.aantalLocaties || 1);
  });
  const g4Bcd = g4Cities.reduce((s, c) => s + (repCityCount[c] || 0), 0);
  const g4Pct = g4Total > 0 ? Math.round((g4Bcd / g4Total) * 100) : 0;


  const MiniGauge = ({ pct }: { pct: number }) => {
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
          stroke={pctColor(pct)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
    );
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      {/* Aangesloten Coffeeshops */}
      <div
        className="bg-card rounded-lg border border-border p-4 sm:p-5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => navigate("/leden?tab=coffeeshops")}
      >
        <div className="flex items-center justify-between">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Vertegenwoordigde Coffeeshops</p>
          <Users size={18} className="text-primary" />
        </div>
        <p className="text-xl sm:text-2xl font-bold font-display mt-1.5">{representedLocations}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isAdmin ? `${totalMembers + activeLeadsCount} leden & leads` : `${totalMembers} leden`}
        </p>
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
        <p className="text-xl sm:text-2xl font-bold font-display mt-1.5">{cityPct}%</p>
        <p className="text-xs text-muted-foreground mt-0.5">in {matchedCities} van {totalNLCities} gemeenten</p>
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
          <MiniGauge pct={marketPct} />
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
          <MiniGauge pct={g4Pct} />
          <p className="text-center text-lg sm:text-xl font-bold font-display -mt-1">{g4Pct}%</p>
          <p className="text-xs text-muted-foreground text-center">{g4Bcd}/{g4Total} coffeeshops</p>
        </div>
      </div>

      {/* Benchmark */}
      <div className="bg-card rounded-lg border border-border p-4 sm:p-5 sm:col-span-2 lg:col-span-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Benchmark</p>
          <BarChart3 size={18} className="text-primary" />
        </div>
        <div className="space-y-1.5">
          {[
            { name: "BCD", pct: marketPct },
            { name: "KHN", pct: 21 },
            { name: "CVAH", pct: 17 },
            { name: "MKB-NL", pct: 7 },
          ].map((b) => (
            <div key={b.name} className="flex items-center gap-2">
              <span className="text-xs font-medium w-14 shrink-0">{b.name}</span>
              <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${b.pct}%`, backgroundColor: pctColor(b.pct) }}
                />
              </div>
              <span className="text-xs font-bold w-8 text-right">{b.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StatCards;
