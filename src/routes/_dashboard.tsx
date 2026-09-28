import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";

export const Route = createFileRoute("/_dashboard")({
  head: () => socialHead({ title: "BCD Ledenportaal", description: "Beveiligde toegang tot het ledenportaal van de Bond van Cannabis Detaillisten.", path: "/" }),
  component: () => (
    <ProtectedRoute>
      <DashboardLayout />
    </ProtectedRoute>
  ),
});
