import { createFileRoute } from "@tanstack/react-router";
import EnqueteInvullenPage from "@/pages/EnqueteInvullenPage";

export const Route = createFileRoute("/_dashboard/enquetes/$id/")({
  component: EnqueteInvullenPage,
});
