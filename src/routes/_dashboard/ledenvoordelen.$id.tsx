import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import BenefitDetailPage from "@/pages/BenefitDetailPage";

export const Route = createFileRoute("/_dashboard/ledenvoordelen/$id")({
  head: ({ params }) => socialHead({ title: 'Ledenvoordelen — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: `/ledenvoordelen/${encodeURIComponent(params.id)}` }),

  component: BenefitDetailPage,
});
