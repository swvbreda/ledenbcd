import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import ResetPasswordPage from "@/pages/ResetPasswordPage";

export const Route = createFileRoute("/reset-password")({
  head: () => socialHead({ title: 'Wachtwoord herstellen — BCD', description: 'Herstel je toegang tot het BCD Ledenportaal met je persoonlijke herstel-link.', path: '/reset-password', image: '/social/login.jpg' }),
  component: ResetPasswordPage,
});
