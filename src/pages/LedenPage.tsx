import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Users, UserMinus, Store, UserPlus } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import MemberFilters from "@/components/MemberFilters";
import MemberTable from "@/components/MemberTable";
import CoffeeshopTable from "@/components/CoffeeshopTable";
import ExportButton from "@/components/ExportButton";
import MailingExportButton from "@/components/MailingExportButton";
import { useMembers, allMembers as membersOnly, allLeads, allMembersAndLeads } from "@/hooks/useMembers";
import { getArchivedIds } from "@/hooks/useArchive";
import { useMergedMembers } from "@/hooks/useMemberEdits";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ViewTab = "leden" | "leads" | "coffeeshops";

const LedenPage = () => {
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [showArchived, setShowArchived] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>(tabParam === "coffeeshops" ? "coffeeshops" : "leden");

  useEffect(() => {
    if (tabParam === "coffeeshops") setActiveTab("coffeeshops");
    else if (tabParam === "leden") setActiveTab("leden");
  }, [tabParam]);
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

  const leadIdSet = useMemo(() => new Set(allLeads.map((l) => l.id)), []);

  const totalLocations = useMemo(
    () => mergedSearched.reduce((sum, m) => sum + m.aantalLocaties, 0),
    [mergedSearched]
  );

  const ledenCount = useMemo(
    () => mergedSearched.filter((m) => !leadIdSet.has(m.id)).length,
    [mergedSearched, leadIdSet]
  );
  const leadsCount = useMemo(
    () => mergedSearched.filter((m) => leadIdSet.has(m.id)).length,
    [mergedSearched, leadIdSet]
  );

  const subtitle = showArchived
    ? `${archivedMembers.length} oud-leden`
    : activeTab === "leden"
    ? `${ledenCount} leden${leadsCount > 0 ? ` · ${leadsCount} leads` : ""}`
    : `${totalLocations} coffeeshops`;

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display">
            {showArchived ? "Oud-leden" : activeTab === "leden" ? "Ledenbestand" : "Coffeeshopbestand"}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {!showArchived && isAdmin && <ExportButton members={mergedSearched} />}
          {!showArchived && isAdmin && <MailingExportButton members={mergedSearched} />}
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
        <>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ViewTab)}>
            <TabsList>
              <TabsTrigger value="leden" className="gap-1.5">
                <Users size={14} />
                Leden ({ledenCount})
              </TabsTrigger>
              <TabsTrigger value="coffeeshops" className="gap-1.5">
                <Store size={14} />
                Coffeeshops ({totalLocations})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
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
        </>
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
      ) : activeTab === "leden" ? (
        <MemberTable members={mergedSearched} />
      ) : (
        <CoffeeshopTable members={mergedSearched} leadIds={leadIdSet} />
      )}
    </div>
  );
};

export default LedenPage;
