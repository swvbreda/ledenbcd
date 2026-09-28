import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import BestuurBeheerPage from "@/pages/BestuurBeheerPage";

export const Route = createFileRoute("/_dashboard/bestuur-beheer")({
  head: () => socialHead({ title: 'Bestuursbeheer — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/bestuur-beheer' }),

  component: BestuurBeheerPage,
});
