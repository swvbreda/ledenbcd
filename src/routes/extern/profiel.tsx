import { createFileRoute } from "@tanstack/react-router";
import ExternProtectedRoute from "@/components/ExternProtectedRoute";
import ExternProfielPage from "@/pages/ExternProfielPage";

export const Route = createFileRoute("/extern/profiel")({
  component: () => (
    <ExternProtectedRoute>
      <ExternProfielPage />
    </ExternProtectedRoute>
  ),
});
