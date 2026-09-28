import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import RegisterGemeenteDetailPage from "@/pages/RegisterGemeenteDetailPage";

export const Route = createFileRoute("/_dashboard/coffeeshopregister/gemeente/$gemeente")({
  head: ({ params }) => socialHead({ title: 'Coffeeshopregister — Gemeente — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: `/coffeeshopregister/gemeente/${encodeURIComponent(params.gemeente)}` }),

  component: RegisterGemeenteDetailPage,
});
