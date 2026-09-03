import { createFileRoute } from "@tanstack/react-router";
import ExternProtectedRoute from "@/components/ExternProtectedRoute";
import ExternProductDetailPage from "@/pages/ExternProductDetailPage";

export const Route = createFileRoute("/extern/product/$id")({
  component: () => (
    <ExternProtectedRoute>
      <ExternProductDetailPage />
    </ExternProtectedRoute>
  ),
});
