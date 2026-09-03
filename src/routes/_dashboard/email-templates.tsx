import { createFileRoute } from "@tanstack/react-router";
import EmailTemplatesPage from "@/pages/EmailTemplatesPage";

export const Route = createFileRoute("/_dashboard/email-templates")({
  component: EmailTemplatesPage,
});
