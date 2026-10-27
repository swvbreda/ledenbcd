import { createFileRoute } from "@tanstack/react-router";
import { socialHead } from "@/lib/socialHead";
import BelangrijkeDocumentenPage from "@/pages/BelangrijkeDocumentenPage";

export const Route = createFileRoute("/_dashboard/belangrijke-documenten")({
  head: () => socialHead({ title: "Belangrijke documenten — BCD", description: "Beveiligde brieven, analyses en documenten voor leden van de Bond van Cannabis Detaillisten, geordend op onderwerp.", path: "/belangrijke-documenten" }),
  component: BelangrijkeDocumentenPage,
});