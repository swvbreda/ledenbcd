import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import MijnVragenPage from "@/pages/MijnVragenPage";

export const Route = createFileRoute("/_dashboard/mijn-vragen")({
  head: () => socialHead({ title: "Mijn vragen — BCD", description: "Beveiligde pagina van het BCD Ledenportaal.", path: "/mijn-vragen" }),
  component: MijnVragenPage,
});
