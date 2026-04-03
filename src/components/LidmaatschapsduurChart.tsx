import { TrendingUp, Building2, Clock, UserPlus, Award, UserCheck } from "lucide-react";
import type { Member } from "@/data/types";
import coffeeshopData from "@/data/coffeeshops-nl.json";
import verloopDetail from "@/data/verloop-detail.json";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useMergedMembers } from "@/hooks/useMemberEdits";
import { useLeadConversions } from "@/hooks/useLeadConversions";
import { getMembershipYears } from "@/lib/membership";
import { aggregateByGemeente, getGemeente } from "@/data/gemeenteMapping";

const LidmaatschapsduurChart = ({ members }: { members?: Member[] }) => {
  const { rawLeads } = useMembersData();
  const { members: mergedLeads } = useMergedMembers(rawLeads);
  const { conversions } = useLeadConversions();

  // Build converted leads as members
  const convertedAsMembers = conversions.map((conv) => {
    const originalLead = mergedLeads.find((l) => l.id === conv.lead_id);
    if (!originalLead) return null;
    return { ...originalLead, id: conv.lidnummer, lidSinds: conv.lid_sinds ?? originalLead.lidSinds } as Member;
  }).filter(Boolean) as Member[];

  const allMembers = [...(members || []), ...convertedAsMembers];
  const memberYears = allMembers.map((m) => ({ member: m, years: getMembershipYears(m) }));
  const withYears = memberYears.filter((x) => x.years !== null) as { member: Member; years: number }[];

  const longMembers = withYears.filter((x) => x.years >= 20);
  const longPct = allMembers.length ? Math.round((longMembers.length / allMembers.length) * 100) : 0;

  // Cities where BCD is present (at least 1 location)
  const perStad = aggregateByGemeente(coffeeshopData.perStad as Record<string, number>);
  const convertedLeadIds = new Set(conversions.map((c) => c.lead_id));
  const unconvertedLeads = mergedLeads.filter((l) => !convertedLeadIds.has(l.id));
  const represented = [...allMembers, ...unconvertedLeads];
  const cityCount: Record<string, number> = {};
  represented.forEach((m) => {
    const gemeente = getGemeente(m.plaats);
    if (gemeente) cityCount[gemeente] = (cityCount[gemeente] || 0) + 1;
  });
  const citiesPresent = Object.keys(perStad).filter((city) => (cityCount[city] || 0) > 0);
  const citiesPresentPct = Object.keys(perStad).length > 0
    ? Math.round((citiesPresent.length / Object.keys(perStad).length) * 100)
    : 0;

  // New members this year
  const currentYear = new Date().getFullYear();
  const currentYearData = verloopDetail.find((d) => d.year === currentYear);
  const newThisYear = currentYearData?.instroom || 0;

  // Average membership duration
  const avgYears = withYears.length
    ? Math.round(withYears.reduce((s, x) => s + x.years, 0) / withYears.length)
    : 0;

  // Longest member
  const longest = withYears.reduce<{ member: Member; years: number } | null>(
    (max, x) => (!max || x.years > max.years ? x : max),
    null
  );

  // Newest member (highest lidSinds year = most recently joined)
  const newest = withYears.reduce<{ member: Member; years: number } | null>(
    (min, x) => {
      if (!min) return x;
      // Compare by lidSinds (higher = more recent), fall back to years (lower = more recent)
      const xStart = x.member.lidSinds ?? 0;
      const minStart = min.member.lidSinds ?? 0;
      if (xStart > minStart) return x;
      if (xStart === minStart && x.years < min.years) return x;
      return min;
    },
    null
  );

  const facts = [
    {
      icon: Clock,
      label: "Langer dan 20 jaar lid",
      value: `${longPct}%`,
      detail: `${longMembers.length} leden`,
      color: "text-primary",
    },
    {
      icon: Building2,
      label: "Gemeenten >50% vertegenwoordigd",
      value: `${citiesOver50Pct}%`,
      detail: `${citiesOver50.length} van ${Object.keys(perStad).length} gemeenten`,
      color: "text-success",
    },
    {
      icon: UserPlus,
      label: `Nieuwe leden in ${currentYear}`,
      value: `${newThisYear}`,
      detail: "",
      color: "text-primary",
    },
    {
      icon: TrendingUp,
      label: "Gem. lidmaatschapsduur",
      value: `${avgYears} jr`,
      detail: `${withYears.length} leden met data`,
      color: "text-primary",
    },
    {
      icon: Award,
      label: "Langst lid",
      value: `${longest?.years || 0} jr`,
      detail: longest?.member.naam || "",
      color: "text-success",
    },
    {
      icon: UserCheck,
      label: "Nieuwste lid",
      value: newest ? `${newest.years} jr` : "—",
      detail: newest?.member.naam || "",
      color: "text-primary",
    },
  ];

  return (
    <div className="bg-white rounded-lg border-2 border-primary/60 p-5">
      <h3 className="text-sm font-semibold font-display mb-1">Kernfeiten</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Belangrijke cijfers over het ledenbestand
      </p>

      <div className="space-y-3">
        {facts.map((f) => (
          <div key={f.label} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <div className={`shrink-0 ${f.color}`}>
              <f.icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">{f.label}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold font-display leading-tight">{f.value}</p>
              {f.detail && <p className="text-xs text-muted-foreground">{f.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LidmaatschapsduurChart;
