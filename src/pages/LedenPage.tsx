import { useState, useMemo } from "react";
import { Users, UserMinus } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import MemberFilters from "@/components/MemberFilters";
import MemberTable from "@/components/MemberTable";
import ExportButton from "@/components/ExportButton";
import { useMembers, allMembers as membersOnly, allLeads, allMembersAndLeads } from "@/hooks/useMembers";
import { getArchivedIds } from "@/hooks/useArchive";
import { useMergedMembers } from "@/hooks/useMemberEdits";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const LedenPage = () => {
  const { isAdmin } = useAuth();
  const [showArchived, setShowArchived] = useState(false);
  const {
    searchQuery, setSearchQuery,
    filterCity, setFilterCity,
    filterStadsdeel, setFilterStadsdeel,
    filterJaren, setFilterJaren,
    cities, stadsdelen,
    hasActiveFilters,
    searchedMembers,
    clearFilters,
    allMembers,
  } = useMembers();

  const { members: mergedSearched } = useMergedMembers(searchedMembers);

  const archivedIds = useMemo(() => getArchivedIds(), []);
  const archivedMembersRaw = useMemo(
    () => allMembersAndLeads.filter((m) => archivedIds.includes(m.id)),
    [archivedIds]
  );
  const { members: archivedMembers } = useMergedMembers(archivedMembersRaw);

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display">
            {showArchived ? "Oud-leden" : "Ledenlijst"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {showArchived
              ? `${archivedMembers.length} oud-leden`
              : `${mergedSearched.length} resultaten · ${membersOnly.length} leden, ${allLeads.length} leads`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!showArchived && isAdmin && <ExportButton members={mergedSearched} />}
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? (
              <><Users size={14} /> Actieve leden</>
            ) : (
              <><UserMinus size={14} /> Oud-leden ({archivedMembers.length})</>
            )}
          </Button>
        </div>
      </div>

      {!showArchived && (
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <MemberFilters
            cities={cities}
            stadsdelen={stadsdelen}
            selectedCity={filterCity}
            selectedStadsdeel={filterStadsdeel}
            selectedJaren={filterJaren}
            onCityChange={setFilterCity}
            onStadsdeelChange={setFilterStadsdeel}
            onJarenChange={setFilterJaren}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      )}

      {showArchived ? (
        archivedMembers.length > 0 ? (
          <MemberTable members={archivedMembers} />
        ) : (
          <div className="bg-card rounded-lg border border-border p-12 text-center">
            <UserMinus size={40} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">Geen oud-leden</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Oud-leden verschijnen hier wanneer ze worden gearchiveerd vanuit een lidpagina.
            </p>
          </div>
        )
      ) : (
        <MemberTable members={mergedSearched} />
      )}
    </div>
  );
};

export default LedenPage;
