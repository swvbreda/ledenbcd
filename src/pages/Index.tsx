import StatCards from "@/components/StatCards";
import VerloopChart from "@/components/VerloopChart";
import LidmaatschapsduurChart from "@/components/LidmaatschapsduurChart";
import GemeentenOverzicht from "@/components/GemeentenOverzicht";
import JubileumOverzicht from "@/components/JubileumOverzicht";
import BestuurOverzicht from "@/components/BestuurOverzicht";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useMergedMembers } from "@/hooks/useMemberEdits";

const Index = () => {
  const { rawMembers } = useMembersData();
  const { members } = useMergedMembers(rawMembers);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold font-display">Overzicht</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Welkom bij het Ledenbestand Dashboard
        </p>
      </div>

      <BestuurOverzicht members={members} />

      <StatCards members={members} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
        <VerloopChart />
        <LidmaatschapsduurChart members={members} />
      </div>

      <GemeentenOverzicht members={members} />

      <JubileumOverzicht members={members} />
    </div>
  );
};

export default Index;
