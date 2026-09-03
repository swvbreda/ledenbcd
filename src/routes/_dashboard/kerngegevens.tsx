import { createFileRoute } from "@tanstack/react-router";
import KerngegevensPage from "@/pages/KerngegevensPage";

export const Route = createFileRoute("/_dashboard/kerngegevens")({
  component: KerngegevensPage,
});
