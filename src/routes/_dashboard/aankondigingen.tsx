import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import AankondigingenPage from "@/pages/AankondigingenPage";

export const Route = createFileRoute("/_dashboard/aankondigingen")({
  head: () => socialHead({ title: 'Aankondigingen — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/aankondigingen' }),

  component: AankondigingenPage,
});
