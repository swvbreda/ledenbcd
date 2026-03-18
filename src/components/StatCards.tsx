import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, MapPin, Building2, Clock, AlertTriangle, UserCheck, ChevronDown, ChevronUp } from "lucide-react";
import type { Member } from "@/data/types";

interface StatCardsProps {
  members: Member[];
}

interface FieldCheck {
  label: string;
  check: (m: Member) => boolean;
}

const COMPLETENESS_FIELDS: FieldCheck[] = [
  { label: "Contactpersoon", check: (m) => m.contacten?.length > 0 },
  { label: "Telefoon", check: (m) => m.contacten?.some(c => !!c.telefoon) },
  { label: "Email", check: (m) => m.contacten?.some(c => !!c.email) },
  { label: "KVK", check: (m) => !!m.kvk },
  { label: "Factuur Bedrijf", check: (m) => !!m.factuurBedrijfsnaam },
  { label: "Factuur Email", check: (m) => !!m.factuurEmail },
  { label: "Oprichtingsdatum", check: (m) => !!m.oprichtingsDatum },
];

const StatCards = ({ members }: StatCardsProps) => {
  const [showIncomplete, setShowIncomplete] = useState(false);
  const navigate = useNavigate();

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

  const stats = [
    { label: "Totaal Leden", value: totalMembers, icon: Users, color: "text-primary", desc: `${totalLocations} locaties` },
    { label: "Steden", value: uniqueCities, icon: Building2, color: "text-primary", desc: "verspreid over NL" },
    { label: "Gem. Lidmaatschap", value: `${avgYears} jr`, icon: Clock, color: "text-success", desc: `${withYears.length} met data` },
    { label: "Compleetheid", value: `${Math.round(((totalMembers - incomplete) / totalMembers) * 100)}%`, icon: incomplete > 0 ? AlertTriangle : UserCheck, color: incomplete > 0 ? "text-destructive" : "text-success", desc: incomplete > 0 ? `${incomplete} onvolledig` : "Alle compleet", expandable: true },
  ];

  // Build per-member missing fields
  const incompleteMemberDetails = members
    .map((m) => {
      const missing = COMPLETENESS_FIELDS.filter(f => !f.check(m)).map(f => f.label);
      return { member: m, missing };
    })
    .filter(x => x.missing.length > 0)
    .sort((a, b) => b.missing.length - a.missing.length);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const isExpandable = 'expandable' in stat && stat.expandable;
          return (
            <div
              key={stat.label}
              className={`bg-card rounded-lg border border-border p-4 sm:p-5 ${isExpandable ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""}`}
              onClick={isExpandable ? () => setShowIncomplete(!showIncomplete) : undefined}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">{stat.label}</p>
                <div className="flex items-center gap-1">
                  <Icon size={18} className={stat.color} />
                  {isExpandable && (showIncomplete ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />)}
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-bold font-display mt-1.5">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.desc}</p>
            </div>
          );
        })}
      </div>

      {showIncomplete && incompleteMemberDetails.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-5 space-y-5">
          <div>
            <h3 className="text-sm font-semibold font-display mb-1">Data Compleetheid per veld</h3>
            <p className="text-xs text-muted-foreground mb-3">Percentage leden met ingevulde gegevens</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              {COMPLETENESS_FIELDS.map((f) => {
                const pct = Math.round((members.filter(f.check).length / members.length) * 100);
                return (
                  <div key={f.label} className="rounded-lg border border-border p-3 text-center">
                    <p className="text-lg font-bold font-display" style={{ color: pct >= 80 ? 'hsl(var(--success))' : pct >= 50 ? 'hsl(32, 95%, 55%)' : 'hsl(var(--destructive))' }}>{pct}%</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold font-display mb-1">Onvolledige gegevens</h3>
            <p className="text-xs text-muted-foreground mb-4">
              {incompleteMemberDetails.length} leden missen één of meer velden
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground w-12">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Naam</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Ontbrekend</th>
                  </tr>
                </thead>
                <tbody>
                  {incompleteMemberDetails.map(({ member, missing }) => (
                    <tr
                      key={member.id}
                      className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/leden/${member.id}`)}
                    >
                      <td className="px-3 py-2 text-muted-foreground">{member.id}</td>
                      <td className="px-3 py-2 font-medium font-display">{member.naam}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {missing.map(f => (
                            <span key={f} className="px-2 py-0.5 rounded text-xs bg-destructive/10 text-destructive">
                              {f}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatCards;
