import { createFileRoute } from "@tanstack/react-router";
import ExternProtectedRoute from "@/components/ExternProtectedRoute";
import ExternDashboardPage from "@/pages/ExternDashboardPage";

export const Route = createFileRoute("/extern/")({
  component: () => (
    <ExternProtectedRoute>
      <ExternDashboardPage />
    </ExternProtectedRoute>
  ),
});
