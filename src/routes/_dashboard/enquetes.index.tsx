import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import EnquetesPage from "@/pages/EnquetesPage";

export const Route = createFileRoute("/_dashboard/enquetes/")({
  head: () => socialHead({ title: 'Enquêtes — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/enquetes' }),

  component: EnquetesPage,
});
