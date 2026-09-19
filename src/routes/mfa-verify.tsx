import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/mfa-verify")({
  component: () => <Navigate to="/" replace />,
});
