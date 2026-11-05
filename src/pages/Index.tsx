import { lazy, Suspense } from "react";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import StatCards from "@/components/StatCards";
import LidmaatschapsduurChart from "@/components/LidmaatschapsduurChart";
import GemeentenOverzicht from "@/components/GemeentenOverzicht";
import JubileumOverzicht from "@/components/JubileumOverzicht";
import BestuurOverzicht from "@/components/BestuurOverzicht";
import LoadingSpinner from "@/components/LoadingSpinner";
import MemberAlertBanner from "@/components/MemberAlertBanner";
import AgendaDashboardCard from "@/components/agenda/AgendaDashboardCard";
import AnnouncementsDashboardCard from "@/components/AnnouncementsDashboardCard";

import { useMembersData } from "@/contexts/MembersDataContext";
import { useMergedMembers } from "@/hooks/useMemberEdits";

const KerngegevensDashboard = lazy(() => import("@/pages/KerngegevensPage"));
const VerloopChart = lazy(() => import("@/components/VerloopChart"));

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
    <div className="w-full min-w-0 max-w-full space-y-6 overflow-x-hidden p-4 sm:p-6">
      <BcdHeroBanner
        title="Overzicht"
        subtitle="Welkom bij het BCD Dashboard"
      />

      <MemberAlertBanner />

      <AnnouncementsDashboardCard />

      <BestuurOverzicht members={members} />

      <AgendaDashboardCard />

      <StatCards members={members} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
        <Suspense fallback={<div className="min-h-96"><LoadingSpinner message="Ledenverloop laden..." /></div>}>
          <VerloopChart members={members} />
        </Suspense>
        <LidmaatschapsduurChart members={members} />
      </div>

      <GemeentenOverzicht members={members} />

      <JubileumOverzicht members={members} />

      <Suspense fallback={<div className="min-h-96"><LoadingSpinner message="Kerngegevens laden..." /></div>}>
        <KerngegevensDashboard />
      </Suspense>
    </div>
  );
};

export default Index;
