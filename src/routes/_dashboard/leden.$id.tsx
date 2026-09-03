import { createFileRoute } from "@tanstack/react-router";
import MemberDetail from "@/pages/MemberDetail";

export const Route = createFileRoute("/_dashboard/leden/$id")({
  component: MemberDetail,
});
