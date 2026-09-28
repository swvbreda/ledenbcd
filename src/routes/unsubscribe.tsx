import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import UnsubscribePage from "@/pages/UnsubscribePage";

export const Route = createFileRoute("/unsubscribe")({
  head: () => socialHead({ title: 'Uitschrijven — BCD', description: 'Beheer je e-mailvoorkeuren bij de Bond van Cannabis Detaillisten.', path: '/unsubscribe', image: '/social/login.jpg' }),
  component: UnsubscribePage,
});
