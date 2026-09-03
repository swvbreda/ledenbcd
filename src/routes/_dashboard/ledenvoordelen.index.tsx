import { createFileRoute } from "@tanstack/react-router";
import LedenvoordelenPage from "@/pages/LedenvoordelenPage";

export const Route = createFileRoute("/_dashboard/ledenvoordelen/")({
  component: LedenvoordelenPage,
});
