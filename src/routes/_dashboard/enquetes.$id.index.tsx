import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import EnqueteInvullenPage from "@/pages/EnqueteInvullenPage";

export const Route = createFileRoute("/_dashboard/enquetes/$id/")({
  head: ({ params }) => socialHead({ title: 'Enquêtes — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: `/enquetes/${encodeURIComponent(params.id)}` }),

  component: EnqueteInvullenPage,
});
