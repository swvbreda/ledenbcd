import { createFileRoute } from "@tanstack/react-router";
import FinancienPage from "@/pages/FinancienPage";

export const Route = createFileRoute("/_dashboard/financien")({
  component: FinancienPage,
});
