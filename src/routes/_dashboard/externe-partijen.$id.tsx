import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import ExternePartijDetailPage from "@/pages/ExternePartijDetailPage";

export const Route = createFileRoute("/_dashboard/externe-partijen/$id")({
  head: ({ params }) => socialHead({ title: 'Externe partijen — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: `/externe-partijen/${encodeURIComponent(params.id)}` }),

  component: ExternePartijDetailPage,
});
