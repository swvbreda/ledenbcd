import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";

export const Route = createFileRoute("/_dashboard/")({
  head: () => socialHead({ title: 'Ledenportaal — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/' }),

  component: Index,
});
