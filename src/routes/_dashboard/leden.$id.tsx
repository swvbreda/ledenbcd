import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import MemberDetail from "@/pages/MemberDetail";

export const Route = createFileRoute("/_dashboard/leden/$id")({
  head: ({ params }) => socialHead({ title: 'Leden — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: `/leden/${encodeURIComponent(params.id)}` }),

  component: MemberDetail,
});
