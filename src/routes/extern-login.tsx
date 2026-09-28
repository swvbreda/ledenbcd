import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import ExternLoginPage from "@/pages/ExternLoginPage";

export const Route = createFileRoute("/extern-login")({
  head: () => socialHead({ title: 'Inloggen externe partijen — BCD', description: 'Inloggen op het portaal voor externe partijen van de Bond van Cannabis Detaillisten.', path: '/extern-login', image: '/social/extern-login.jpg' }),
  component: ExternLoginPage,
});
