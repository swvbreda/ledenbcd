import BcdHeroBanner from "@/components/BcdHeroBanner";
import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Users, UserMinus, Store, UserPlus, MessageSquare, Search, ListChecks, List } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import MemberFilters from "@/components/MemberFilters";
import MemberTable from "@/components/MemberTable";
import CoffeeshopTable from "@/components/CoffeeshopTable";
import ExportButton from "@/components/ExportButton";
import MailingExportButton from "@/components/MailingExportButton";
import NewMemberDialog from "@/components/NewMemberDialog";
import WhatsAppMatcher from "@/components/WhatsAppMatcher";
import CommunityDeelnemersTable from "@/components/CommunityDeelnemersTable";
import { useMembers } from "@/hooks/useMembers";
import { useMembersData } from "@/contexts/MembersDataContext";

import { useMergedMembers } from "@/hooks/useMemberEdits";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import LoadingSpinner from "@/components/LoadingSpinner";

type ViewTab = "leden" | "leads" | "coffeeshops" | "community";
type CommunitySubTab = "matcher" | "deelnemers";

const LedenPage = () => {
  const { isAdmin, isInhuur, isBoard } = useAuth();
  const canSeeLeads = isAdmin || isInhuur;
  const canSeeCommunity = isAdmin || isBoard;
  const { allMembersAndLeads, isLoading: dataLoading } = useMembersData();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [showArchived, setShowArchived] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>(
    tabParam === "coffeeshops"
      ? "coffeeshops"
      : tabParam === "leads"
      ? "leads"
      : tabParam === "whatsapp" || tabParam === "community"
      ? "community"
      : "leden"
  );
  const [communitySub, setCommunitySub] = useState<CommunitySubTab>(
    isBoard ? "deelnemers" : "matcher",
  );

  useEffect(() => {
    if (tabParam === "coffeeshops") setActiveTab("coffeeshops");
    else if (tabParam === "leads") setActiveTab("leads");
    else if (tabParam === "whatsapp" || tabParam === "community") setActiveTab("community");
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
    activeLeadIds,
  } = useMembers();

  const { members: mergedSearched } = useMergedMembers(searchedMembers);

  const { rawOldMembers } = useMembersData();
  const { members: archivedMembers } = useMergedMembers(rawOldMembers);

  const leadIdSet = useMemo(() => activeLeadIds, [activeLeadIds]);

  const totalLocations = useMemo(
    () => mergedSearched.reduce((sum, m) => sum + m.aantalLocaties, 0),
    [mergedSearched]
  );

  const ledenOnly = useMemo(
    () => mergedSearched.filter((m) => !leadIdSet.has(m.id)),
    [mergedSearched, leadIdSet]
  );
  const leadsOnly = useMemo(
    () => mergedSearched.filter((m) => leadIdSet.has(m.id)),
    [mergedSearched, leadIdSet]
  );

  const subtitle = showArchived
    ? `${archivedMembers.length} oud-leden`
    : activeTab === "coffeeshops"
    ? `${totalLocations} coffeeshops`
    : activeTab === "community"
    ? `WhatsApp-community beheer`
    : canSeeLeads
    ? `${mergedSearched.length} leden + leads`
    : `${ledenOnly.length} leden`;

  if (dataLoading) {
    return (
      <div className="p-4 sm:p-6">
        <LoadingSpinner message="Ledenbestand laden..." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 overflow-hidden">
      <BcdHeroBanner
        title={
          showArchived
            ? "Oud-leden"
            : activeTab === "leden"
            ? "Ledenbestand"
            : activeTab === "leads"
            ? "Leads"
            : activeTab === "community"
            ? "Community"
            : "Coffeeshopbestand"
        }
        subtitle={subtitle}
      />
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div />
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? (
              <><Users size={14} /> <span className="hidden sm:inline">Actieve leden</span><span className="sm:hidden">Actief</span></>
            ) : (
              <><UserMinus size={14} /> Oud-leden ({archivedMembers.length})</>
            )}
          </Button>
        </div>
        {!showArchived && isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <ExportButton members={mergedSearched} />
            <MailingExportButton members={mergedSearched} />
            <NewMemberDialog type={activeTab === "leads" ? "lead" : "member"} />
          </div>
        )}
      </div>

      {!showArchived && (
        <>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ViewTab)}>
            <TabsList>
              <TabsTrigger value="leden" className="gap-1.5">
                <Users size={14} />
                Leden ({ledenOnly.length})
              </TabsTrigger>
              {canSeeLeads && (
                <TabsTrigger value="leads" className="gap-1.5">
                  <UserPlus size={14} />
                  Leads ({leadsOnly.length})
                </TabsTrigger>
              )}
              <TabsTrigger value="coffeeshops" className="gap-1.5">
                <Store size={14} />
                Coffeeshops ({totalLocations})
              </TabsTrigger>
              {canSeeCommunity && (
                <TabsTrigger value="community" className="gap-1.5">
                  <MessageSquare size={14} />
                  Community
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          {activeTab !== "community" && (
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
          )}
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
        <MemberTable members={ledenOnly} />
      ) : activeTab === "leads" ? (
        <MemberTable members={leadsOnly} />
      ) : activeTab === "coffeeshops" ? (
        <CoffeeshopTable members={mergedSearched} leadIds={leadIdSet} />
      ) : (
        <Tabs
          value={communitySub}
          onValueChange={(v) => setCommunitySub(v as CommunitySubTab)}
          className="space-y-4"
        >
          <TabsList>
            {isBoard && (
              <TabsTrigger value="deelnemers" className="gap-1.5">
                <ListChecks size={14} /> Community deelnemers
              </TabsTrigger>
            )}
            <TabsTrigger value="matcher" className="gap-1.5">
              <Search size={14} /> Matcher
            </TabsTrigger>
          </TabsList>
          {isBoard && (
            <TabsContent value="deelnemers">
              <CommunityDeelnemersTable />
            </TabsContent>
          )}
          <TabsContent value="matcher">
            <WhatsAppMatcher />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default LedenPage;
