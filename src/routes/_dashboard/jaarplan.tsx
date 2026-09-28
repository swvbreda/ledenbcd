import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import JaarplanPage from "@/pages/JaarplanPage";

export const Route = createFileRoute("/_dashboard/jaarplan")({
  head: () => socialHead({ title: 'Jaarplan — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/jaarplan' }),

  component: JaarplanPage,
});
