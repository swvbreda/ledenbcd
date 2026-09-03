import { createFileRoute } from "@tanstack/react-router";
import AgendaPage from "@/pages/AgendaPage";

export const Route = createFileRoute("/_dashboard/agenda/")({
  component: AgendaPage,
});
