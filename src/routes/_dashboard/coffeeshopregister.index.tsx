import { createFileRoute } from "@tanstack/react-router";
import CoffeeshopRegisterPage from "@/pages/CoffeeshopRegisterPage";

export const Route = createFileRoute("/_dashboard/coffeeshopregister/")({
  component: CoffeeshopRegisterPage,
});
