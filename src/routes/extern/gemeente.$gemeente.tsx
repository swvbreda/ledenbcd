import { createFileRoute } from "@tanstack/react-router";
import ExternProtectedRoute from "@/components/ExternProtectedRoute";
import ExternGemeenteDetailPage from "@/pages/ExternGemeenteDetailPage";

export const Route = createFileRoute("/extern/gemeente/$gemeente")({
  component: () => (
    <ExternProtectedRoute>
      <ExternGemeenteDetailPage />
    </ExternProtectedRoute>
  ),
});
