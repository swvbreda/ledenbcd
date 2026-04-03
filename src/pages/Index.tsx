import StatCards from "@/components/StatCards";
import VerloopChart from "@/components/VerloopChart";
import LidmaatschapsduurChart from "@/components/LidmaatschapsduurChart";
import GemeentenOverzicht from "@/components/GemeentenOverzicht";
import JubileumOverzicht from "@/components/JubileumOverzicht";
import BestuurOverzicht from "@/components/BestuurOverzicht";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useMergedMembers } from "@/hooks/useMemberEdits";

const Index = () => {
  const { rawMembers, isLoading } = useMembersData();
  const { members } = useMergedMembers(rawMembers);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6">
        <LoadingSpinner message="Dashboard laden..." />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <BcdHeroBanner
        title="Overzicht"
        subtitle="Welkom bij het Ledenbestand Dashboard"
      />

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
