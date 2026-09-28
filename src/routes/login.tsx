import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import LoginPage from "@/pages/LoginPage";

export const Route = createFileRoute("/login")({
  head: () => socialHead({ title: 'Inloggen — BCD Ledenportaal', description: 'Log in op het ledenportaal van de Bond van Cannabis Detaillisten.', path: '/login', image: '/social/login.jpg' }),
  component: LoginPage,
});
