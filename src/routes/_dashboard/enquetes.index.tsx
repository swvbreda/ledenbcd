import { createFileRoute } from "@tanstack/react-router";
import EnquetesPage from "@/pages/EnquetesPage";

export const Route = createFileRoute("/_dashboard/enquetes/")({
  component: EnquetesPage,
});
