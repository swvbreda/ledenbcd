import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import ExternProtectedRoute from "@/components/ExternProtectedRoute";
import ExternProfielPage from "@/pages/ExternProfielPage";

export const Route = createFileRoute("/extern/profiel")({
  head: () => socialHead({ title: 'Profiel — Extern portaal BCD', description: 'Beveiligd profiel voor externe partners van BCD.', path: '/extern/profiel', image: '/social/login.jpg' }),
  component: () => (
    <ExternProtectedRoute>
      <ExternProfielPage />
    </ExternProtectedRoute>
  ),
});
