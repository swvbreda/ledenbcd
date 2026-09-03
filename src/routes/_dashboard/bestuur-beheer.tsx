import { createFileRoute } from "@tanstack/react-router";
import BestuurBeheerPage from "@/pages/BestuurBeheerPage";

export const Route = createFileRoute("/_dashboard/bestuur-beheer")({
  component: BestuurBeheerPage,
});
