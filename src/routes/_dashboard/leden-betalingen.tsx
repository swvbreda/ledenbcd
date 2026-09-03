import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/leden-betalingen")({
  beforeLoad: () => {
    throw redirect({ to: "/financien", replace: true });
  },
});
