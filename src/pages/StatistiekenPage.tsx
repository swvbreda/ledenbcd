import BcdHeroBanner from "@/components/BcdHeroBanner";
import StatCards from "@/components/StatCards";
import VerloopChart from "@/components/VerloopChart";
import LidmaatschapsduurChart from "@/components/LidmaatschapsduurChart";
import LedenPerStadOverzicht from "@/components/LedenPerStadOverzicht";
import StedenDekkingOverzicht from "@/components/StedenDekkingOverzicht";
import { useMembersData } from "@/contexts/MembersDataContext";

const StatistiekenPage = () => {
  const { rawMembers: allMembers } = useMembersData();
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <BcdHeroBanner
        title="Statistieken"
        subtitle="Overzicht van alle ledendata"
      />

      <StatCards members={allMembers} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <VerloopChart />
        <LidmaatschapsduurChart />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <LedenPerStadOverzicht members={allMembers} />
        <StedenDekkingOverzicht members={allMembers} />
      </div>
    </div>
  );
};

export default StatistiekenPage;
