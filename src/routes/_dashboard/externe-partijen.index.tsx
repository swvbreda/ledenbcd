import { createFileRoute } from "@tanstack/react-router";
import ExternePartijenPage from "@/pages/ExternePartijenPage";

export const Route = createFileRoute("/_dashboard/externe-partijen/")({
  component: ExternePartijenPage,
});
