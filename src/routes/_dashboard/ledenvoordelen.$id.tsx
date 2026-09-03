import { createFileRoute } from "@tanstack/react-router";
import BenefitDetailPage from "@/pages/BenefitDetailPage";

export const Route = createFileRoute("/_dashboard/ledenvoordelen/$id")({
  component: BenefitDetailPage,
});
