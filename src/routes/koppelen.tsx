import { createFileRoute } from "@tanstack/react-router";
import CommunityKoppelPage from "@/pages/CommunityKoppelPage";

export const Route = createFileRoute("/koppelen")({
  head: () => ({
    meta: [
      { title: "Koppel je gegevens — BCD community" },
      {
        name: "description",
        content:
          "Vul je naam, telefoonnummer en coffeeshop in zodat de Bond van Cannabis Detaillisten je WhatsApp-deelname aan je lidmaatschap koppelt.",
      },
      { property: "og:title", content: "Koppel je gegevens — BCD community" },
      {
        property: "og:description",
        content:
          "Deelnemers van de WhatsApp-community vullen hier hun gegevens in voor koppeling aan hun coffeeshop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommunityKoppelPage,
});
