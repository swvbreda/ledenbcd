import { socialHead } from "@/lib/socialHead";
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/leden-betalingen")({
  head: () => socialHead({ title: 'Ledenbetalingen — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/leden-betalingen' }),

  beforeLoad: () => {
    throw redirect({ to: "/financien", replace: true });
  },
});
