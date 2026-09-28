import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import ExternProtectedRoute from "@/components/ExternProtectedRoute";
import ExternGemeenteDetailPage from "@/pages/ExternGemeenteDetailPage";

export const Route = createFileRoute("/extern/gemeente/$gemeente")({
  head: ({ params }) => socialHead({ title: 'Gemeente — Extern portaal BCD', description: 'Beveiligde gemeentepagina voor externe partners van BCD.', path: `/extern/gemeente/${encodeURIComponent(params.gemeente)}`, image: '/social/login.jpg' }),
  component: () => (
    <ExternProtectedRoute>
      <ExternGemeenteDetailPage />
    </ExternProtectedRoute>
  ),
});
