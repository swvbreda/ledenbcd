import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import VergaderagendaPage from "@/pages/VergaderagendaPage";

export const Route = createFileRoute("/_dashboard/vergaderagenda")({
  head: () => socialHead({ title: "Vergaderagenda — BCD", description: "Beveiligde pagina van het BCD Ledenportaal.", path: "/vergaderagenda" }),
  component: VergaderagendaPage,
});
