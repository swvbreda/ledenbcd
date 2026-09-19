import { createFileRoute } from "@tanstack/react-router";
import KennisbankPage from "@/pages/KennisbankPage";

export const Route = createFileRoute("/_dashboard/kennisbank")({
  component: KennisbankPage,
});
