import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import ExternProtectedRoute from "@/components/ExternProtectedRoute";
import ExternDashboardPage from "@/pages/ExternDashboardPage";

export const Route = createFileRoute("/extern/")({
  head: () => socialHead({ title: 'Extern portaal — BCD', description: 'Beveiligde toegang voor externe partners van BCD.', path: '/extern', image: '/social/login.jpg' }),
  component: () => (
    <ExternProtectedRoute>
      <ExternDashboardPage />
    </ExternProtectedRoute>
  ),
});
