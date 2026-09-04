import { createFileRoute } from "@tanstack/react-router";

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

/**
 * Openbare afbeelding van één gedeeld agendapunt (op basis van de deelcode).
 * Wordt gebruikt als og:image in de deel-preview. Alleen de afbeelding van
 * het opgevraagde agendapunt is bereikbaar; de bucket blijft privé.
 */
export const Route = createFileRoute("/api/public/agenda-image/$code")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const code = (params.code ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 12).toUpperCase();
        if (!code) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: rows, error } = await supabaseAdmin.rpc("get_agenda_share", { _code: code });
        if (error) return new Response("Not found", { status: 404 });
        const ev = Array.isArray(rows) ? rows[0] : null;
        const path = (ev as { image_path?: string | null } | null)?.image_path;
        if (!path) return new Response("Not found", { status: 404 });

        const { data: file, error: dlError } = await supabaseAdmin.storage
          .from("agenda-images")
          .download(path);
        if (dlError || !file) return new Response("Not found", { status: 404 });

        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        const type = file.type && file.type !== "application/json" ? file.type : (MIME[ext] ?? "image/jpeg");

        return new Response(await file.arrayBuffer(), {
          status: 200,
          headers: {
            "Content-Type": type,
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
