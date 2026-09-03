import { createFileRoute } from "@tanstack/react-router";
import GoedkeuringenPage from "@/pages/GoedkeuringenPage";

export const Route = createFileRoute("/_dashboard/goedkeuringen")({
  component: GoedkeuringenPage,
});
