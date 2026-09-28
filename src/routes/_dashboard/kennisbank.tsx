import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import KennisbankPage from "@/pages/KennisbankPage";

export const Route = createFileRoute("/_dashboard/kennisbank")({
  head: () => socialHead({ title: 'Kennisbank — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/kennisbank' }),

  component: KennisbankPage,
});
