import { createFileRoute } from "@tanstack/react-router";
import CheckoutReturn from "@/pages/CheckoutReturn";

export const Route = createFileRoute("/checkout/return")({
  component: CheckoutReturn,
});
