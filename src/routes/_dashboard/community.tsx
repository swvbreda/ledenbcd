import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import CommunityPage from "@/pages/CommunityPage";

export const Route = createFileRoute("/_dashboard/community")({
  head: () => socialHead({ title: 'Community — BCD', description: "Beveiligde pagina van het BCD Ledenportaal.", path: '/community' }),

  component: CommunityPage,
});
