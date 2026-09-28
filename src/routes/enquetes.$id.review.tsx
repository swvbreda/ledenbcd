import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import ProtectedRoute from "@/components/ProtectedRoute";
import EnqueteReviewPage from "@/pages/EnqueteReviewPage";

export const Route = createFileRoute("/enquetes/$id/review")({
  head: ({ params }) => socialHead({ title: 'Enquête beoordelen — BCD', description: 'Beveiligde toegang tot de enquêtebeoordeling van BCD.', path: `/enquetes/${encodeURIComponent(params.id)}/review`, image: '/social/login.jpg' }),
  component: () => (
    <ProtectedRoute>
      <EnqueteReviewPage />
    </ProtectedRoute>
  ),
});
