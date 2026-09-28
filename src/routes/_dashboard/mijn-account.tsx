import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import MijnAccountPage from "@/pages/MijnAccountPage";

export const Route = createFileRoute("/_dashboard/mijn-account")({
  head: () => socialHead({ title: 'Mijn account — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/mijn-account' }),

  component: MijnAccountPage,
});
