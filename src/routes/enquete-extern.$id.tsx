import { createFileRoute } from "@tanstack/react-router";
import EnqueteExternPage from "@/pages/EnqueteExternPage";

export const Route = createFileRoute("/enquete-extern/$id")({
  component: EnqueteExternPage,
});
