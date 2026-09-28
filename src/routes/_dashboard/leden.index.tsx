import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import LedenPage from "@/pages/LedenPage";

export const Route = createFileRoute("/_dashboard/leden/")({
  head: () => socialHead({ title: 'Leden — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/leden' }),

  component: LedenPage,
});
