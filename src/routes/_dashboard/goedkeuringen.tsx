import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import GoedkeuringenPage from "@/pages/GoedkeuringenPage";

export const Route = createFileRoute("/_dashboard/goedkeuringen")({
  head: () => socialHead({ title: 'Goedkeuringen — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/goedkeuringen' }),

  component: GoedkeuringenPage,
});
