import { useState, useMemo } from "react";
import type { Member } from "@/data/types";
import { getArchivedIds } from "@/hooks/useArchive";
import { getMembershipYears } from "@/lib/membership";
import { stadsdeelCategorieen, getStadsdeelCategorie } from "@/data/stadsdeelCategorie";
import { useLeadConversions, type LeadConversion } from "@/hooks/useLeadConversions";
import { useMembersData } from "@/contexts/MembersDataContext";

export function useMembers() {
  const { rawMembers, rawLeads, isLoading: dataLoading } = useMembersData();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterStadsdeel, setFilterStadsdeel] = useState("");
  const [filterJaren, setFilterJaren] = useState("");
  const { conversions } = useLeadConversions();

  const { members: effectiveMembers, leads: effectiveLeads } = useMemo(
    () => applyConversions(rawMembers, rawLeads, conversions),
    [rawMembers, rawLeads, conversions]
  );

  const archivedIds = useMemo(() => getArchivedIds(), []);
  const effectiveAll = useMemo(
    () => [...effectiveMembers, ...effectiveLeads],
    [effectiveMembers, effectiveLeads]
  );
  const allIncludingLeads = useMemo(
    () => effectiveAll.filter((m) => !archivedIds.includes(m.id)),
    [effectiveAll, archivedIds]
  );

  /** Set of lead IDs that have NOT been converted */
  const activeLeadIds = useMemo(
    () => new Set(effectiveLeads.map((l) => l.id)),
    [effectiveLeads]
  );

  const cities = useMemo(
    () => [...new Set(allIncludingLeads.map((m) => m.plaats).filter(Boolean))].sort(),
    [allIncludingLeads]
  );
  const stadsdelen = useMemo(() => [...stadsdeelCategorieen], []);

  const hasActiveFilters = !!(filterCity || filterStadsdeel || filterJaren);

  const filteredMembers = useMemo(() => {
    return allIncludingLeads.filter((m) => {
      if (filterCity && m.plaats !== filterCity) return false;
      if (filterStadsdeel && (!m.stadsdeel || getStadsdeelCategorie(m.stadsdeel) !== filterStadsdeel)) return false;
      if (filterJaren) {
        const [min, max] = filterJaren.split("-").map(Number);
        const years = getMembershipYears(m);
        if (years === null) return false;
        if (years < min || years > max) return false;
      }
      return true;
    });
  }, [allIncludingLeads, filterCity, filterStadsdeel, filterJaren]);

  const searchedMembers = useMemo(() => {
    if (!searchQuery) return filteredMembers;
    const q = searchQuery.toLowerCase();
    return filteredMembers.filter(
      (m) =>
        m.naam.toLowerCase().includes(q) ||
        m.plaats.toLowerCase().includes(q) ||
        m.contactpersoon.toLowerCase().includes(q) ||
        m.bedrijfsnaam.toLowerCase().includes(q) ||
        String(m.id).includes(q) ||
        (m.factuurBedrijfsnaam || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        (m.telefoon || "").toLowerCase().includes(q) ||
        m.contacten?.some((c) =>
          c.naam.toLowerCase().includes(q) ||
          (c.email || "").toLowerCase().includes(q) ||
          (c.telefoon || "").toLowerCase().includes(q)
        ) ||
        m.locaties.some((l) =>
          l.naam.toLowerCase().includes(q) ||
          (l.plaats || "").toLowerCase().includes(q) ||
          (l.adres || "").toLowerCase().includes(q)
        )
    );
  }, [filteredMembers, searchQuery]);

  const clearFilters = () => {
    setFilterCity("");
    setFilterStadsdeel("");
    setFilterJaren("");
  };

  return {
    searchQuery,
    setSearchQuery,
    filterCity,
    setFilterCity,
    filterStadsdeel,
    setFilterStadsdeel,
    filterJaren,
    setFilterJaren,
    cities,
    stadsdelen,
    hasActiveFilters,
    filteredMembers,
    searchedMembers,
    clearFilters,
    allMembers: rawMembers,
    activeLeadIds,
    effectiveMembers,
    effectiveLeads,
    conversions,
    dataLoading,
  };
}
