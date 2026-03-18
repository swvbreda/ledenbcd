import { Users, MapPin, Building2, Clock } from "lucide-react";
import type { Member } from "@/data/types";

interface StatCardsProps {
  members: Member[];
}

const StatCards = ({ members }: StatCardsProps) => {
  const totalMembers = members.length;
  const totalLocations = members.reduce((sum, m) => sum + m.aantalLocaties, 0);
  const uniqueCities = new Set(members.map((m) => m.plaats).filter(Boolean)).size;
  const avgYears = Math.round(
    members.filter((m) => m.jarenLid).reduce((sum, m) => sum + (m.jarenLid || 0), 0) /
      members.filter((m) => m.jarenLid).length
  );

  const stats = [
    { label: "Totaal Leden", value: totalMembers, icon: Users, color: "text-primary" },
    { label: "Locaties", value: totalLocations, icon: MapPin, color: "text-success" },
    { label: "Steden", value: uniqueCities, icon: Building2, color: "text-primary" },
    { label: "Gem. Lidmaatschap", value: `${avgYears} jr`, icon: Clock, color: "text-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div key={stat.label} className="bg-card rounded-lg border border-border p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
              <Icon size={18} className={stat.color} />
            </div>
            <p className="text-2xl font-bold font-display mt-2">{stat.value}</p>
          </div>
        );
      })}
    </div>
  );
};

export default StatCards;
