import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, ExternalLink, Shield } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import type { Member } from "@/data/types";
import { allLeads } from "@/hooks/useMembers";
import { getMembershipYears } from "@/lib/membership";
import { supabase } from "@/integrations/supabase/client";

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

/** Jubilee tier based on traditional Dutch jubilee colors */
const getJubileumTier = (jaren: number): { bg: string; text: string; label: string } => {
  if (jaren >= 30) return { bg: "bg-amber-100", text: "text-amber-700", label: "Pareljubileum" };
  if (jaren >= 25) return { bg: "bg-slate-200", text: "text-slate-600", label: "Zilveren jubileum" };
  if (jaren >= 20) return { bg: "bg-sky-100", text: "text-sky-700", label: "Porseleinen jubileum" };
  if (jaren >= 15) return { bg: "bg-indigo-100", text: "text-indigo-600", label: "Kristallen jubileum" };
  if (jaren >= 10) return { bg: "bg-orange-100", text: "text-orange-700", label: "Koperen jubileum" };
  if (jaren >= 5) return { bg: "bg-emerald-100", text: "text-emerald-700", label: "Houten jubileum" };
  return { bg: "bg-muted", text: "text-muted-foreground", label: "" };
};

const MemberTable = ({ members, compact }: MemberTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortAsc, setSortAsc] = useState(true);
  const navigate = useNavigate();
  const { isAdmin, linkedMemberId } = useAuth();
  const [boardMemberIds, setBoardMemberIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchBoardMembers = async () => {
      const { data } = await supabase.from("board_members").select("lid_id, lid_ids");
      if (data) {
        const ids = new Set<number>();
        for (const row of data) {
          if (row.lid_id) ids.add(row.lid_id);
          if (row.lid_ids) for (const id of row.lid_ids) ids.add(id);
        }
        setBoardMemberIds(ids);
      }
    };
    fetchBoardMembers();
  }, []);

  const isLead = (m: Member) => allLeads.some((l) => l.id === m.id);
  const getKey = (m: Member) => (isLead(m) ? `lead-${m.id}` : `member-${m.id}`);

  const sorted = [...members].sort((a, b) => {
    // Leads always at the bottom
    const aLead = isLead(a);
    const bLead = isLead(b);
    if (aLead !== bLead) return aLead ? 1 : -1;

    if (sortKey === "gemeenten") {
      const av = getGemeenten(a).length;
      const bv = getGemeenten(b).length;
      return sortAsc ? av - bv : bv - av;
    }

    if (sortKey === "jarenLid") {
      const av = getMembershipYears(a) ?? -1;
      const bv = getMembershipYears(b) ?? -1;
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

  // Mobile card view
  const MobileCard = ({ member: m }: { member: Member }) => {
    const memberIsLead = isLead(m);
    const gemeenten = getGemeenten(m);
    const jarenLid = getMembershipYears(m);
    return (
      <div
        className="p-3 border-b border-border active:bg-muted/30 transition-colors cursor-pointer"
        onClick={() => navigate(`/leden/${m.id}`)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium font-display text-sm">{m.naam}</span>
            </div>
            {(() => {
              const eigenaar = m.contacten.find(c => c.functie?.toLowerCase() === "eigenaar")?.naam;
              if (!eigenaar && !m.oprichter && !boardMemberIds.has(m.id)) return null;
              return (
                <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
                  {eigenaar && <span>{eigenaar}</span>}
                  {m.oprichter && <span className="text-amber-500">★</span>}
                  {boardMemberIds.has(m.id) && <Shield size={11} className="text-primary" />}
                </div>
              );
            })()}
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {!memberIsLead && <span className="font-mono">#{m.id}</span>}
              <span>{gemeenten.join(", ")}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {jarenLid !== null && (() => {
              const tier = getJubileumTier(jarenLid);
              return (
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${tier.bg} ${tier.text}`}>{jarenLid} jr</span>
              );
            })()}
            <span className="text-xs tabular-nums text-muted-foreground">{m.aantalLocaties} loc.</span>
            <ExternalLink size={14} className="text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Mobile card list */}
      <div className="md:hidden">
        {displayMembers.map((member) => (
          <MobileCard key={getKey(member)} member={member} />
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm font-body">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-center font-semibold text-muted-foreground w-24">
                Lidnr.
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors min-w-[200px]" onClick={() => handleSort("naam")}>
                <span className="inline-flex items-center gap-1">Naam <SortIcon col="naam" /></span>
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
              <th className="px-4 py-3 text-center font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors w-24" onClick={() => handleSort("oprichtingJaar")}>
                <span className="inline-flex items-center gap-1">Oprichting <SortIcon col="oprichtingJaar" /></span>
              </th>
              <th className="px-4 py-3 text-center font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors w-20" onClick={() => handleSort("aantalLocaties")}>
                <span className="inline-flex items-center gap-1">Locaties <SortIcon col="aantalLocaties" /></span>
              </th>
              <th className="px-4 py-3 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort("gemeenten")}>
                <span className="inline-flex items-center gap-1">Gemeenten <SortIcon col="gemeenten" /></span>
              </th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {displayMembers.map((member) => {
              const memberIsLead = isLead(member);
              const gemeenten = getGemeenten(member);
              const jarenLid = getMembershipYears(member);
              const eigenaar = member.contacten.find(c => c.functie?.toLowerCase() === "eigenaar")?.naam || "";
              const storedCp = (() => { try { return localStorage.getItem(`bcd-contactpersoon-${member.id}`); } catch { return null; } })();
              const contactpersoon = storedCp || member.contactpersoon || member.contacten[0]?.naam || "";
              return (
              <tr
                key={getKey(member)}
                className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer group"
                onClick={() => navigate(`/leden/${member.id}`)}
              >
                <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">
                  {memberIsLead ? (isAdmin ? "—" : "") : member.id}
                </td>
                <td className="px-4 py-3 font-medium font-display whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    {member.naam}
                    {member.oprichter && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help text-amber-500">★</span>
                          </TooltipTrigger>
                          <TooltipContent><p>Oprichter van de bond</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {boardMemberIds.has(member.id) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help"><Shield size={12} className="text-primary" /></span>
                          </TooltipTrigger>
                          <TooltipContent><p>Bestuurslid</p></TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {memberIsLead && isAdmin && (
                      <span className="inline-flex items-center px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[10px] font-semibold uppercase tracking-wide">
                        Lead
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {jarenLid !== null ? (() => {
                    const tier = getJubileumTier(jarenLid);
                    return (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${tier.bg} ${tier.text}`}>
                              {jarenLid} jr
                            </span>
                          </TooltipTrigger>
                          {tier.label && (
                            <TooltipContent><p>{tier.label}</p></TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })() : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                {isAdmin && (
                  <>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        {eigenaar || "—"}
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
                    <td className="px-4 py-3 text-muted-foreground text-xs">{contactpersoon || "—"}</td>
                  </>
                )}
                <td className="px-4 py-3 text-center text-muted-foreground tabular-nums">
                  {member.oprichtingJaar || "—"}
                </td>
                <td className="px-4 py-3 text-center tabular-nums">{member.aantalLocaties}</td>
                <td className="px-4 py-3">
                  <span className="text-muted-foreground text-xs">
                    {gemeenten.join(", ")}
                  </span>
                </td>
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
      {isAdmin && (
        <div className="hidden md:flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="text-amber-500">★</span> Oprichter</span>
          <span className="flex items-center gap-1"><Shield size={10} className="text-primary" /> Bestuurslid</span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-emerald-100 border border-emerald-300" /> 5+ jr Hout</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-orange-100 border border-orange-300" /> 10+ jr Koper</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-indigo-100 border border-indigo-300" /> 15+ jr Kristal</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-sky-100 border border-sky-300" /> 20+ jr Porselein</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-slate-200 border border-slate-400" /> 25+ jr Zilver</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-amber-100 border border-amber-300" /> 30+ jr Parel</span>
        </div>
      )}
    </div>
  );
};

export default MemberTable;
