import { createFileRoute } from "@tanstack/react-router";
import GemeenteDetailPage from "@/pages/GemeenteDetailPage";

export const Route = createFileRoute("/_dashboard/locaties/$gemeente")({
  component: GemeenteDetailPage,
});
