import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/mfa-setup")({
  component: () => <Navigate to="/" replace />,
});
