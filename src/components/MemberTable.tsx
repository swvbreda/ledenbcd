import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, ExternalLink, Shield } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import type { Member } from "@/data/types";
import { allLeads } from "@/hooks/useMembers";

interface MemberTableProps {
  members: Member[];
  compact?: boolean;
}

type SortKey = "id" | "naam" | "oprichtingJaar" | "aantalLocaties" | "gemeenten" | "jarenLid";

const getGemeenten = (member: Member): string[] => {
  const set = new Set<string>();
  for (const l of member.locaties) {
    const plaats = l.plaats || member.plaats;
    if (plaats) set.add(plaats);
  }
  return Array.from(set);
};

const MemberTable = ({ members, compact }: MemberTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortAsc, setSortAsc] = useState(true);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const sorted = [...members].sort((a, b) => {
    if (sortKey === "gemeenten") {
      const av = getGemeenten(a).length;
      const bv = getGemeenten(b).length;
      return sortAsc ? av - bv : bv - av;
    }
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

  const displayMembers = compact ? sorted.slice(0, 10) : sorted;

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort("naam")}>
                <span className="inline-flex items-center gap-1">Naam <SortIcon col="naam" /></span>
              </th>
              <th className="px-4 py-3 text-center font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors w-24" onClick={() => handleSort("oprichtingJaar")}>
                <span className="inline-flex items-center gap-1">Oprichting <SortIcon col="oprichtingJaar" /></span>
              </th>
              <th className="px-4 py-3 text-center font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors w-20" onClick={() => handleSort("aantalLocaties")}>
                <span className="inline-flex items-center gap-1">Locaties <SortIcon col="aantalLocaties" /></span>
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort("gemeenten")}>
                <span className="inline-flex items-center gap-1">Gemeenten <SortIcon col="gemeenten" /></span>
              </th>
              <th className="px-4 py-3 text-center font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors w-24" onClick={() => handleSort("jarenLid")}>
                <span className="inline-flex items-center gap-1">Jaren Lid <SortIcon col="jarenLid" /></span>
              </th>
              {isAdmin && (
                <>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Eigenaar</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Contactpersoon</th>
                </>
              )}
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {displayMembers.map((member) => {
              const isLead = allLeads.some((l) => l.id === member.id);
              const gemeenten = getGemeenten(member);
              const eigenaar = member.contacten.find(c => c.functie?.toLowerCase() === "eigenaar")?.naam || "";
              const storedCp = (() => { try { return localStorage.getItem(`bcd-contactpersoon-${member.id}`); } catch { return null; } })();
              const contactpersoon = storedCp || member.contactpersoon || member.contacten[0]?.naam || "";
              return (
              <tr
                key={member.id}
                className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => navigate(`/leden/${member.id}`)}
              >
                <td className="px-4 py-3 font-medium font-display">
                  <span className="inline-flex items-center gap-1.5">
                    {member.naam}
                    {isLead && (
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[10px] font-semibold uppercase tracking-wide">
                        Lead
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">
                  {member.oprichtingJaar || "—"}
                </td>
                <td className="px-4 py-3 text-center tabular-nums">{member.aantalLocaties}</td>
                <td className="px-4 py-3">
                  <span className="text-muted-foreground text-xs">
                    {gemeenten.join(", ")}
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
                  <td className="px-4 py-3 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      {contactpersoon || "—"}
                      {member.oprichter && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help text-amber-500">★</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Oprichter van de bond</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {member.bestuursfunctie && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-help"><Shield size={12} className="text-primary" /></span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{member.bestuursfunctie}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </span>
                  </td>
                )}
                <td className="px-4 py-3">
                  <ExternalLink size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </td>
              </tr>
              );
            })}
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
