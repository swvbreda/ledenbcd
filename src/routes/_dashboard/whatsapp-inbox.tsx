import { createFileRoute } from "@tanstack/react-router";
import WhatsAppInboxPage from "@/pages/WhatsAppInboxPage";

export const Route = createFileRoute("/_dashboard/whatsapp-inbox")({
  component: WhatsAppInboxPage,
});
