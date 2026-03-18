import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import StatCards from "@/components/StatCards";
import MemberTable from "@/components/MemberTable";
import CityChart from "@/components/CityChart";
import StadsdeelChart from "@/components/StadsdeelChart";
import YearChart from "@/components/YearChart";
import VerloopChart from "@/components/VerloopChart";
import InstroomUitstroomChart from "@/components/InstroomUitstroomChart";
import { allMembers } from "@/hooks/useMembers";

const Index = () => {
  const navigate = useNavigate();

  const recentMembers = useMemo(
    () => allMembers.filter((m) => m.jarenLid !== null && m.jarenLid <= 10),
    []
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold font-display">Overzicht</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Welkom bij het BCD Ledenbestand Dashboard
        </p>
      </div>

      <StatCards members={allMembers} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <CityChart members={allMembers} />
        <StadsdeelChart members={allMembers} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <YearChart members={allMembers} />
        <VerloopChart />
      </div>

      <InstroomUitstroomChart />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold font-display">Recente Leden (&le; 10 jaar)</h3>
          <button
            onClick={() => navigate("/leden")}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Alle leden <ArrowRight size={14} />
          </button>
        </div>
        <MemberTable members={recentMembers} compact />
      </div>
    </div>
  );
};

export default Index;
