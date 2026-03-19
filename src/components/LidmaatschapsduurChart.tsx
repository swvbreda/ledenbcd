import { TrendingUp, Building2, Clock, UserPlus, Award, UserCheck } from "lucide-react";
import type { Member } from "@/data/types";
import coffeeshopData from "@/data/coffeeshops-nl.json";
import verloopDetail from "@/data/verloop-detail.json";
import { allRepresented } from "@/hooks/useMembers";
import { getMembershipYears } from "@/lib/membership";

const LidmaatschapsduurChart = ({ members }: { members?: Member[] }) => {
  const memberYears = (members || []).map((m) => ({ member: m, years: getMembershipYears(m) }));
  const withYears = memberYears.filter((x) => x.years !== null) as { member: Member; years: number }[];

  const longMembers = withYears.filter((x) => x.years >= 20);
  const longPct = members?.length ? Math.round((longMembers.length / members.length) * 100) : 0;

  // Cities with >50% representation
  const perStad = coffeeshopData.perStad as Record<string, number>;
  const represented = allRepresented;
  const cityCount: Record<string, number> = {};
  represented.forEach((m) => {
    if (m.plaats) cityCount[m.plaats] = (cityCount[m.plaats] || 0) + (m.aantalLocaties || 1);
  });
  const citiesOver50 = Object.entries(perStad).filter(([city, total]) => {
    const bcd = cityCount[city] || 0;
    return total > 0 && (bcd / total) >= 0.5;
  }).length;

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

  // Newest member (lowest years, most recent)
  const newest = withYears.reduce<{ member: Member; years: number } | null>(
    (min, x) => (!min || x.years < min.years ? x : min),
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
      value: `${citiesOver50}`,
      detail: `van ${Object.keys(perStad).length} gemeenten`,
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
  ];

  return (
    <div className="bg-card rounded-lg border border-border p-5">
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
