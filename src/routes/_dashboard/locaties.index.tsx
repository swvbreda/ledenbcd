import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import LocatiesPage from "@/pages/LocatiesPage";

export const Route = createFileRoute("/_dashboard/locaties/")({
  head: () => socialHead({ title: 'Locaties — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/locaties' }),

  component: LocatiesPage,
});
