import { useNavigate } from "@/lib/router-compat";
import { Users, Building2, MapPin, PieChart, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Member } from "@/data/types";
import { useRegisterStats } from "@/hooks/useRegisterStats";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useLeadConversions } from "@/hooks/useLeadConversions";
import { useMergedMembers } from "@/hooks/useMemberEdits";
import { getLocationGemeente } from "@/data/gemeenteMapping";
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
  const {
    perGemeente: perStad,
    totaalNL: totalNL,
    representedPerGemeente: repCityCount,
    totaalRepresented,
    fromRegister,
    dataUpdatedAt,
    refetch: refetchStats,
    isFetching: statsFetching,
  } = useRegisterStats();
  const totalNLCities = Object.keys(perStad).length;
  const representedGemeenten = new Set(
    allRepresented.flatMap((m) => {
      const locaties = m.locaties?.length ? m.locaties : [{ naam: m.naam, plaats: m.plaats }];
      return locaties.map((l) => getLocationGemeente(l, m.plaats)).filter((g) => g in perStad);
    })
  );
  const matchedCities = representedGemeenten.size;
  const cityPct = totalNLCities > 0 ? Math.round((matchedCities / totalNLCities) * 100) : 0;

  const representedLocations = fromRegister ? totaalRepresented : allRepresented.reduce((sum, member) => sum + Math.max(member.locaties?.length || member.aantalLocaties || 1, 1), 0);
  const marketPct = Math.round((representedLocations / totalNL) * 100);
  const g4Cities = ["Amsterdam", "Rotterdam", "Den Haag", "Utrecht"];
  const g4Total = g4Cities.reduce((s, c) => s + (perStad[c] || 0), 0);
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
    <div className="grid w-full max-w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
      {/* Aangesloten Coffeeshops */}
      <div
        className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border-2 border-primary/60 bg-card p-4 transition-colors hover:border-primary sm:p-5 cursor-pointer"
        onClick={() => navigate("/leden?tab=coffeeshops")}
      >
        <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_1.25rem] items-start gap-3">
          <p className="min-w-0 text-xs font-medium leading-tight text-muted-foreground sm:text-sm">Vertegenwoordigde Coffeeshops</p>
          <Users size={18} className="text-brand-red justify-self-end" />
        </div>
        <div className="mt-auto pt-3 text-center">
          <p className="text-3xl sm:text-4xl font-bold font-display tabular-nums">{representedLocations}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {isAdmin ? `${totalMembers + activeLeadsCount} leden & leads` : `${totalMembers} leden`}
          </p>
          {dataUpdatedAt > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                refetchStats();
              }}
              className="mt-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              {statsFetching
                ? "bijwerken…"
                : `bijgewerkt ${new Date(dataUpdatedAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })} · ververs`}
            </button>
          )}
        </div>
      </div>

      {/* Gemeenten */}
      <div
        className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border-2 border-primary/60 bg-card p-4 transition-colors hover:border-primary sm:p-5 cursor-pointer"
        onClick={() => navigate("/locaties")}
      >
        <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_1.25rem] items-start gap-3">
          <p className="min-w-0 text-xs font-medium leading-tight text-muted-foreground sm:text-sm">Gemeenten</p>
          <Building2 size={18} className="text-brand-red justify-self-end" />
        </div>
        <div className="mt-auto pt-3 text-center">
          <p className="text-3xl sm:text-4xl font-bold font-display tabular-nums">{cityPct}%</p>
          <p className="text-xs text-muted-foreground mt-1">in {matchedCities} van {totalNLCities} gemeenten</p>
        </div>
      </div>

      {/* Marktaandeel gauge */}
      <div
        className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border-2 border-primary/60 bg-card p-4 transition-colors hover:border-primary sm:p-5 cursor-pointer"
        onClick={() => navigate("/locaties")}
      >
        <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_1.25rem] items-start gap-3">
          <p className="min-w-0 text-xs font-medium leading-tight text-muted-foreground sm:text-sm">Vertegenwoordiging</p>
          <PieChart size={18} className="text-brand-red justify-self-end" />
        </div>
        <div className="mt-auto pt-2">
          <MiniGauge pct={marketPct} />
          <p className="text-center text-xl sm:text-2xl font-bold font-display tabular-nums -mt-1">{marketPct}%</p>
          <p className="text-xs text-muted-foreground text-center mt-0.5">{representedLocations}/{totalNL} coffeeshops</p>
        </div>
      </div>

      {/* G4 dekking */}
      <div
        className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border-2 border-primary/60 bg-card p-4 transition-colors hover:border-primary sm:p-5 cursor-pointer"
        onClick={() => navigate("/locaties")}
      >
        <div className="grid min-h-11 grid-cols-[minmax(0,1fr)_1.25rem] items-start gap-3">
          <p className="min-w-0 text-xs font-medium leading-tight text-muted-foreground sm:text-sm">G4 dekking</p>
          <MapPin size={18} className="text-success justify-self-end" />
        </div>
        <div className="mt-auto pt-2">
          <MiniGauge pct={g4Pct} />
          <p className="text-center text-xl sm:text-2xl font-bold font-display tabular-nums -mt-1">{g4Pct}%</p>
          <p className="text-xs text-muted-foreground text-center mt-0.5">{g4Bcd}/{g4Total} coffeeshops</p>
        </div>
      </div>

      {/* Benchmark */}
      <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border-2 border-primary/60 bg-card p-4 sm:col-span-2 sm:p-5 lg:col-span-1">
        <div className="mb-2 grid min-h-11 grid-cols-[minmax(0,1fr)_1.25rem] items-start gap-3">
          <p className="min-w-0 text-xs font-medium leading-tight text-muted-foreground sm:text-sm">Benchmark</p>
          <BarChart3 size={18} className="text-brand-red justify-self-end" />
        </div>
        <div className="mt-auto space-y-1.5">
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
