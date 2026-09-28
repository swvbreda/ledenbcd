import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import ExternePartijenPage from "@/pages/ExternePartijenPage";

export const Route = createFileRoute("/_dashboard/externe-partijen/")({
  head: () => socialHead({ title: 'Externe partijen — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/externe-partijen' }),

  component: ExternePartijenPage,
});
