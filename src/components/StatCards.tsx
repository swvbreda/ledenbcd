import { Users, MapPin, Building2, Clock, AlertTriangle, UserCheck } from "lucide-react";
import type { Member } from "@/data/types";

interface StatCardsProps {
  members: Member[];
}

const StatCards = ({ members }: StatCardsProps) => {
  const totalMembers = members.length;
  const totalLocations = members.reduce((sum, m) => sum + m.aantalLocaties, 0);
  const uniqueCities = new Set(members.map((m) => m.plaats).filter(Boolean)).size;
  const withYears = members.filter((m) => m.jarenLid);
  const avgYears = withYears.length
    ? Math.round(withYears.reduce((sum, m) => sum + (m.jarenLid || 0), 0) / withYears.length)
    : 0;
  const incomplete = members.filter(
    (m) => !m.contacten?.length || !m.contacten.some(c => c.telefoon) || !m.contacten.some(c => c.email)
  ).length;
  const withContact = members.filter((m) => m.contactpersoon2).length;

  const stats = [
    { label: "Totaal Leden", value: totalMembers, icon: Users, color: "text-primary", desc: `${totalLocations} locaties` },
    { label: "Steden", value: uniqueCities, icon: Building2, color: "text-primary", desc: "verspreid over NL" },
    { label: "Gem. Lidmaatschap", value: `${avgYears} jr`, icon: Clock, color: "text-success", desc: `${withYears.length} met data` },
    { label: "Compleetheid", value: `${Math.round(((totalMembers - incomplete) / totalMembers) * 100)}%`, icon: incomplete > 0 ? AlertTriangle : UserCheck, color: incomplete > 0 ? "text-destructive" : "text-success", desc: incomplete > 0 ? `${incomplete} onvolledig` : "Alle compleet" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="bg-card rounded-lg border border-border p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">{stat.label}</p>
              <Icon size={18} className={stat.color} />
            </div>
            <p className="text-xl sm:text-2xl font-bold font-display mt-1.5">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.desc}</p>
          </div>
        );
      })}
    </div>
  );
};

export default StatCards;
