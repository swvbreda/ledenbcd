import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import AgendaPage from "@/pages/AgendaPage";

export const Route = createFileRoute("/_dashboard/agenda/")({
  head: () => socialHead({ title: 'Agenda — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/agenda' }),

  component: AgendaPage,
});
