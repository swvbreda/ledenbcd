import { createFileRoute } from "@tanstack/react-router";
import AccountBeheerPage from "@/pages/AccountBeheerPage";

export const Route = createFileRoute("/_dashboard/accounts")({
  component: AccountBeheerPage,
});
