import { socialHead } from "@/lib/socialHead";
import { createFileRoute } from "@tanstack/react-router";
import EnqueteExternPage from "@/pages/EnqueteExternPage";

export const Route = createFileRoute("/enquete-extern/$id")({
  head: ({ params }) => socialHead({ title: 'Enquête toegang — BCD', description: 'Open de enquête van de Bond van Cannabis Detaillisten met je toegangscode.', path: `/enquete-extern/${encodeURIComponent(params.id)}`, image: '/social/enquete-extern.jpg' }),
  component: EnqueteExternPage,
});
