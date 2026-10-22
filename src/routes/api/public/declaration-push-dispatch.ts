import { createFileRoute } from "@tanstack/react-router";

// Alleen voor de interne wekker (x-internal-secret). Uitzetten gebeurt in de database (enabled/claim).
export async function declarationPushPost({ request }: { request: Request }) {
  const { handleDeclarationPushSchedule, declarationPushPort } = await import("@/lib/declarationPush.server");
  return handleDeclarationPushSchedule(request, process.env, declarationPushPort);
}

export const Route = createFileRoute("/api/public/declaration-push-dispatch")({
  server: { handlers: { POST: declarationPushPost } },
});
