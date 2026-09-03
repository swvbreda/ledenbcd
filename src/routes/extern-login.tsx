import { createFileRoute } from "@tanstack/react-router";
import ExternLoginPage from "@/pages/ExternLoginPage";

export const Route = createFileRoute("/extern-login")({
  component: ExternLoginPage,
});
