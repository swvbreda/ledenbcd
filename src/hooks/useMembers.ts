import { useState, useMemo } from "react";
import membersData from "@/data/members.json";
import leadsData from "@/data/leads.json";
import type { Member } from "@/data/types";
import { getArchivedIds } from "@/hooks/useArchive";

export const allMembers = membersData as Member[];
export const allLeads = leadsData as Member[];
/** Members + leads combined — use for market share / representation calculations */
export const allRepresented = [...allMembers, ...allLeads] as Member[];
/** Members + leads combined — use for display in ledenlijst (leads have no lidnummer) */
export const allMembersAndLeads = [...allMembers, ...allLeads] as Member[];

export function useMembers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterStadsdeel, setFilterStadsdeel] = useState("");
  const [filterJaren, setFilterJaren] = useState("");

  const archivedIds = useMemo(() => getArchivedIds(), []);
  const allIncludingLeads = useMemo(
    () => allMembersAndLeads.filter((m) => !archivedIds.includes(m.id)),
    [archivedIds]
  );

  const cities = useMemo(
    () => [...new Set(allIncludingLeads.map((m) => m.plaats).filter(Boolean))].sort(),
    []
  );
  const stadsdelen = useMemo(
    () => [...new Set(allIncludingLeads.map((m) => m.stadsdeel).filter(Boolean))].sort(),
    []
  );

  const hasActiveFilters = !!(filterCity || filterStadsdeel || filterJaren);

  const filteredMembers = useMemo(() => {
    return allIncludingLeads.filter((m) => {
      if (filterCity && m.plaats !== filterCity) return false;
      if (filterStadsdeel && m.stadsdeel !== filterStadsdeel) return false;
      if (filterJaren) {
        const [min, max] = filterJaren.split("-").map(Number);
        if (m.jarenLid === null) return false;
        if (m.jarenLid < min || m.jarenLid > max) return false;
      }
      return true;
    });
  }, [filterCity, filterStadsdeel, filterJaren]);

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
    allMembers,
  };
}
