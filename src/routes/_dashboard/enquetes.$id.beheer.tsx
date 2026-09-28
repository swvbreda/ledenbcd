import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import EnqueteBeheerPage from "@/pages/EnqueteBeheerPage";

export const Route = createFileRoute("/_dashboard/enquetes/$id/beheer")({
  head: ({ params }) => socialHead({ title: 'Enquêtes — Beheer — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: `/enquetes/${encodeURIComponent(params.id)}/beheer` }),

  component: EnqueteBeheerPage,
});
