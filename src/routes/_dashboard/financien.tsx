import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import FinancienPage from "@/pages/FinancienPage";

export const Route = createFileRoute("/_dashboard/financien")({
  head: () => socialHead({ title: 'Financiën — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/financien' }),

  component: FinancienPage,
});
