import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import ProjectenPage from "@/pages/ProjectenPage";

export const Route = createFileRoute("/_dashboard/projecten")({
  head: () => socialHead({ title: "Projecten & taken — BCD", description: "Beveiligde pagina van het BCD Ledenportaal.", path: "/projecten" }),
  component: ProjectenPage,
});
