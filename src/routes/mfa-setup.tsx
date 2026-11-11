import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import MfaSetupPage from "@/pages/MfaSetupPage";

export const Route = createFileRoute("/mfa-setup")({
  head: () => socialHead({ title: 'Beveiliging instellen — BCD', description: 'Beveiligde toegang tot het BCD Ledenportaal.', path: '/mfa-setup', image: '/social/login.jpg' }),
  component: MfaSetupPage,
});
