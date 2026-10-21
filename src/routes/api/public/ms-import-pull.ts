import { createFileRoute } from "@tanstack/react-router";

/** Geplande eenrichtingsimport (Microsoft -> ledenbestand). Interne sleutel + schakelaar + releasegate; standaard uit. */
export async function msImportPullPost({ request }: { request: Request }) {
  const { handleScheduledImport, liveImportGraph } = await import("@/lib/msImportWorker.server");
  return handleScheduledImport(request, process.env, async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return { sb: supabaseAdmin, graph: () => liveImportGraph(process.env) };
  });
}

export const Route = createFileRoute("/api/public/ms-import-pull")({ server: { handlers: { POST: msImportPullPost } } });
