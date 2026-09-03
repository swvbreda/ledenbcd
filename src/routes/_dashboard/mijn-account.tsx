import { createFileRoute } from "@tanstack/react-router";
import MijnAccountPage from "@/pages/MijnAccountPage";

export const Route = createFileRoute("/_dashboard/mijn-account")({
  component: MijnAccountPage,
});
