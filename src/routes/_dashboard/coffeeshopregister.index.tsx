import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import CoffeeshopRegisterPage from "@/pages/CoffeeshopRegisterPage";

export const Route = createFileRoute("/_dashboard/coffeeshopregister/")({
  head: () => socialHead({ title: 'Coffeeshopregister — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/coffeeshopregister' }),

  component: CoffeeshopRegisterPage,
});
