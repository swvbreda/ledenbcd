import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import CheckoutReturn from "@/pages/CheckoutReturn";

export const Route = createFileRoute("/checkout/return")({
  head: () => socialHead({ title: 'Betaalstatus — BCD', description: 'Bekijk de status van je betaling bij BCD.', path: '/checkout/return', image: '/social/login.jpg' }),
  component: CheckoutReturn,
});
