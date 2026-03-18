import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import StatCards from "@/components/StatCards";
import MemberTable from "@/components/MemberTable";
import VerloopChart from "@/components/VerloopChart";
import LidmaatschapsduurChart from "@/components/LidmaatschapsduurChart";
import LedenPerStadOverzicht from "@/components/LedenPerStadOverzicht";
import { allMembers } from "@/hooks/useMembers";

const Index = () => {
  const navigate = useNavigate();


  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold font-display">Overzicht</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Welkom bij het BCD Ledenbestand Dashboard
        </p>
      </div>

      <StatCards members={allMembers} />

      <VerloopChart />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <LidmaatschapsduurChart members={allMembers} />
        <LedenPerStadOverzicht members={allMembers} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold font-display">Alle Leden</h3>
          <button
            onClick={() => navigate("/leden")}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Volledig overzicht <ArrowRight size={14} />
          </button>
        </div>
        <MemberTable members={allMembers} compact />
      </div>
    </div>
  );
};

export default Index;
