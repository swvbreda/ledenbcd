import { createFileRoute } from "@tanstack/react-router";
import EnqueteBeheerPage from "@/pages/EnqueteBeheerPage";

export const Route = createFileRoute("/_dashboard/enquetes/$id/beheer")({
  component: EnqueteBeheerPage,
});
