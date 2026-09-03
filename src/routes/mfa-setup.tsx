import { createFileRoute } from "@tanstack/react-router";
import MfaSetupPage from "@/pages/MfaSetupPage";

export const Route = createFileRoute("/mfa-setup")({
  component: MfaSetupPage,
});
