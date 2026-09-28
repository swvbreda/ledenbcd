import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import ExternProtectedRoute from "@/components/ExternProtectedRoute";
import ExternProductDetailPage from "@/pages/ExternProductDetailPage";

export const Route = createFileRoute("/extern/product/$id")({
  head: ({ params }) => socialHead({ title: 'Product — Extern portaal BCD', description: 'Beveiligde productpagina voor externe partners van BCD.', path: `/extern/product/${encodeURIComponent(params.id)}`, image: '/social/login.jpg' }),
  component: () => (
    <ExternProtectedRoute>
      <ExternProductDetailPage />
    </ExternProtectedRoute>
  ),
});
