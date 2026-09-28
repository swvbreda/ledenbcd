import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/mfa-verify")({
  head: () => socialHead({ title: 'Beveiliging verifiëren — BCD', description: 'Beveiligde toegang tot het BCD Ledenportaal.', path: '/mfa-verify', image: '/social/login.jpg' }),
  component: () => <Navigate to="/" replace />,
});
