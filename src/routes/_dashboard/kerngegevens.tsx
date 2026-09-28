import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/_dashboard/kerngegevens")({
  head: () => socialHead({ title: 'Kerngegevens — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/kerngegevens' }),

  component: () => <Navigate to="/" replace />,
});
