import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, MapPin, Mail, Phone, ExternalLink, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Member } from "@/data/types";

interface MemberTableProps {
  members: Member[];
  compact?: boolean;
}

type SortKey = "id" | "naam" | "plaats" | "jarenLid" | "aantalLocaties";

const MemberTable = ({ members, compact }: MemberTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortAsc, setSortAsc] = useState(true);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const sorted = [...members].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (typeof av === "string" && typeof bv === "string") {
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp size={14} /> : <ChevronDown size={14} />;
  };

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: "id", label: "Lidnr.", className: "w-16" },
    { key: "naam", label: "Naam" },
    { key: "plaats", label: "Plaats" },
    { key: "aantalLocaties", label: "Locaties", className: "w-20 text-center" },
    { key: "jarenLid", label: "Jaren Lid", className: "w-24 text-center" },
  ];

  const displayMembers = compact ? sorted.slice(0, 10) : sorted;

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors ${col.className || ""}`}
                  onClick={() => handleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <SortIcon col={col.key} />
                  </span>
                </th>
              ))}
              {isAdmin && <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Eigenaar</th>}
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {displayMembers.map((member) => (
              <tr
                key={member.id}
                className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => navigate(`/leden/${member.id}`)}
              >
                <td className="px-4 py-3 text-muted-foreground">{member.id}</td>
                <td className="px-4 py-3 font-medium font-display">
                  <span className="inline-flex items-center gap-1.5">
                    {member.naam}
                    {member.oprichter && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 rounded text-[10px] font-semibold uppercase tracking-wide">
                        ★ Oprichter
                      </span>
                    )}
                    {member.bestuursfunctie && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-accent/15 text-accent-foreground rounded text-[10px] font-semibold uppercase tracking-wide">
                        <Shield size={10} />
                        Bestuur
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3">{member.plaats}</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <MapPin size={13} />
                    {member.aantalLocaties}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {member.jarenLid ? (
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        member.jarenLid >= 30
                          ? "bg-success/10 text-success"
                          : member.jarenLid >= 10
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {member.jarenLid} jr
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <span className="text-muted-foreground text-xs">
                      {member.contacten.find(c => c.functie === "Eigenaar")?.naam || member.contactpersoon}
                    </span>
                  </td>
                )}
                <td className="px-4 py-3">
                  <ExternalLink size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {displayMembers.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">Geen leden gevonden</div>
      )}
    </div>
  );
};

export default MemberTable;
