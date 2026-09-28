import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import LedenvoordelenPage from "@/pages/LedenvoordelenPage";

export const Route = createFileRoute("/_dashboard/ledenvoordelen/")({
  head: () => socialHead({ title: 'Ledenvoordelen — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/ledenvoordelen' }),

  component: LedenvoordelenPage,
});
