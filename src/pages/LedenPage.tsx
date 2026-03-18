import SearchBar from "@/components/SearchBar";
import MemberFilters from "@/components/MemberFilters";
import MemberTable from "@/components/MemberTable";
import ExportButton from "@/components/ExportButton";
import { useMembers, allMembers as membersOnly, allLeads } from "@/hooks/useMembers";

const LedenPage = () => {
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

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display">Ledenlijst</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {searchedMembers.length} van {allMembers.length} leden
          </p>
        </div>
        <ExportButton members={searchedMembers} />
      </div>

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

      <MemberTable members={searchedMembers} />
    </div>
  );
};

export default LedenPage;
