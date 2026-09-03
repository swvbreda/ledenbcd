import { createFileRoute } from "@tanstack/react-router";
import MfaVerifyPage from "@/pages/MfaVerifyPage";

export const Route = createFileRoute("/mfa-verify")({
  component: MfaVerifyPage,
});
