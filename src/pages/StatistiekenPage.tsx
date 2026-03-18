import StatCards from "@/components/StatCards";
import VerloopChart from "@/components/VerloopChart";
import LidmaatschapsduurChart from "@/components/LidmaatschapsduurChart";
import LedenPerStadOverzicht from "@/components/LedenPerStadOverzicht";
import { allMembers } from "@/hooks/useMembers";

const StatistiekenPage = () => {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold font-display">Statistieken</h2>
        <p className="text-sm text-muted-foreground mt-1">Overzicht van alle ledendata</p>
      </div>

      <StatCards members={allMembers} />

      <VerloopChart />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <LidmaatschapsduurChart members={allMembers} />
        <LedenPerStadOverzicht members={allMembers} />
      </div>
    </div>
  );
};

export default StatistiekenPage;
