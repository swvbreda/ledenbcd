import { createFileRoute } from "@tanstack/react-router";
import LedenPage from "@/pages/LedenPage";

export const Route = createFileRoute("/_dashboard/leden/")({
  component: LedenPage,
});
