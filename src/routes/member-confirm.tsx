import { createFileRoute } from "@tanstack/react-router";
import MemberConfirmPage from "@/pages/MemberConfirmPage";
import { socialHead } from "@/lib/socialHead";

export const Route = createFileRoute("/member-confirm")({
  head: () => ({ ...socialHead({ title: "E-mailadres bevestigen — BCD", description: "Beveiligde bevestiging voor het BCD Ledenportaal.", path: "/member-confirm" }), meta: [
    ...socialHead({ title: "E-mailadres bevestigen — BCD", description: "Beveiligde bevestiging voor het BCD Ledenportaal.", path: "/member-confirm" }).meta,
    { name: "robots", content: "noindex, nofollow" },
    { name: "referrer", content: "no-referrer" },
  ] }),
  component: MemberConfirmPage,
});
