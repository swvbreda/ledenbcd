import { auth, defineMcp } from "@lovable.dev/mcp-js";
import { lidProfiel, zoekLeden, zoekVestigingen } from "./tools/leden";
import { zoekProjecten, zoekTaken } from "./tools/projecten";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "ledenbestand-bcd",
  title: "Ledenbestand BCD",
  version: "0.1.0",
  instructions:
    "Read-only tools voor beheerders van Ledenbestand BCD: leden en coffeeshopvestigingen zoeken, zakelijke kernprofielen lezen en interne projecten en taken raadplegen. Geen financiële, bank-, UBO- of privégegevens. Elk antwoord bevat bron en peildatum.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [zoekLeden, lidProfiel, zoekVestigingen, zoekProjecten, zoekTaken],
});
