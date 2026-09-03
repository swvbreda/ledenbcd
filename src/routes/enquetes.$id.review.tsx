import { createFileRoute } from "@tanstack/react-router";
import ProtectedRoute from "@/components/ProtectedRoute";
import EnqueteReviewPage from "@/pages/EnqueteReviewPage";

export const Route = createFileRoute("/enquetes/$id/review")({
  component: () => (
    <ProtectedRoute>
      <EnqueteReviewPage />
    </ProtectedRoute>
  ),
});
