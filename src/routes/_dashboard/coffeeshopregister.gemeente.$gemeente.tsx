import { createFileRoute } from "@tanstack/react-router";
import RegisterGemeenteDetailPage from "@/pages/RegisterGemeenteDetailPage";

export const Route = createFileRoute("/_dashboard/coffeeshopregister/gemeente/$gemeente")({
  component: RegisterGemeenteDetailPage,
});
