import { createFileRoute } from "@tanstack/react-router";

/** Geplande Projectmail-run. Interne sleutel + schakelaar + verbonden + actuele beheerder; standaard uit. */
export async function projectMailPullPost({ request }: { request: Request }) {
  const { handleScheduledProjectMail } = await import("@/lib/projectMailWorker.server");
  return handleScheduledProjectMail(request, process.env, async () => (await import("@/integrations/supabase/client.server")).supabaseAdmin);
}

export const Route = createFileRoute("/api/public/projectmail-pull")({ server: { handlers: { POST: projectMailPullPost } } });
