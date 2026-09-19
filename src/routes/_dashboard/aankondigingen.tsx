import { createFileRoute } from "@tanstack/react-router";
import AankondigingenPage from "@/pages/AankondigingenPage";

export const Route = createFileRoute("/_dashboard/aankondigingen")({
  component: AankondigingenPage,
});
