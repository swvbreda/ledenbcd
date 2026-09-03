import { createFileRoute } from "@tanstack/react-router";
import ExternePartijDetailPage from "@/pages/ExternePartijDetailPage";

export const Route = createFileRoute("/_dashboard/externe-partijen/$id")({
  component: ExternePartijDetailPage,
});
