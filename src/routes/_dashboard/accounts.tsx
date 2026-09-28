import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import AccountBeheerPage from "@/pages/AccountBeheerPage";

export const Route = createFileRoute("/_dashboard/accounts")({
  head: () => socialHead({ title: 'Accounts — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/accounts' }),

  component: AccountBeheerPage,
});
