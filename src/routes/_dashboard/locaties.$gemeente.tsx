import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import GemeenteDetailPage from "@/pages/GemeenteDetailPage";

export const Route = createFileRoute("/_dashboard/locaties/$gemeente")({
  head: ({ params }) => socialHead({ title: 'Locaties — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: `/locaties/${encodeURIComponent(params.gemeente)}` }),

  component: GemeenteDetailPage,
});
