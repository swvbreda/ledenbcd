import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import WhatsAppInboxPage from "@/pages/WhatsAppInboxPage";

export const Route = createFileRoute("/_dashboard/whatsapp-inbox")({
  head: () => socialHead({ title: 'WhatsApp inbox — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/whatsapp-inbox' }),

  component: WhatsAppInboxPage,
});
