import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import CommunityKoppelPage from "@/pages/CommunityKoppelPage";

export const Route = createFileRoute("/koppelen")({
  head: () => socialHead({ title: 'Koppel je gegevens — BCD community', description: 'Vul je contactgegevens in voor de koppeling van je WhatsApp-deelname aan je coffeeshop.', path: '/koppelen', image: '/social/koppelen.jpg' }),
  component: CommunityKoppelPage,
});
