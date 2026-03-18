import StatCards from "@/components/StatCards";
import VerloopChart from "@/components/VerloopChart";
import LidmaatschapsduurChart from "@/components/LidmaatschapsduurChart";
import GemeentenOverzicht from "@/components/GemeentenOverzicht";
import JubileumOverzicht from "@/components/JubileumOverzicht";
import BestuurOverzicht from "@/components/BestuurOverzicht";
import { allMembers } from "@/hooks/useMembers";

const Index = () => {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold font-display">Overzicht</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Welkom bij het BCD Ledenbestand Dashboard
        </p>
      </div>

      <BestuurOverzicht members={allMembers} />

      <StatCards members={allMembers} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <VerloopChart />
        <LidmaatschapsduurChart members={allMembers} />
      </div>

      <GemeentenOverzicht members={allMembers} />

      <JubileumOverzicht members={allMembers} />
    </div>
  );
};

export default Index;
