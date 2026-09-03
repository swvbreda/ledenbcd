import { createFileRoute } from "@tanstack/react-router";
import UnsubscribePage from "@/pages/UnsubscribePage";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
});
