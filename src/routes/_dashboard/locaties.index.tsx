import { createFileRoute } from "@tanstack/react-router";
import LocatiesPage from "@/pages/LocatiesPage";

export const Route = createFileRoute("/_dashboard/locaties/")({
  component: LocatiesPage,
});
