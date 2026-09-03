import { createFileRoute } from "@tanstack/react-router";
import JaarplanPage from "@/pages/JaarplanPage";

export const Route = createFileRoute("/_dashboard/jaarplan")({
  component: JaarplanPage,
});
