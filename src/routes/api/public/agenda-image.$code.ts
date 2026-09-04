import { createFileRoute } from "@tanstack/react-router";

/**
 * Openbare afbeelding van één gedeeld agendapunt (op basis van de deelcode).
 * Wordt gebruikt als og:image in de deel-preview. Alleen de afbeelding van
 * het opgevraagde agendapunt is bereikbaar; de bucket blijft privé.
 * De afbeelding wordt op previewformaat (1200x630) geleverd, zodat WhatsApp
 * en LinkedIn hem betrouwbaar tonen.
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

        const { data: signed } = await supabaseAdmin.storage
          .from("agenda-images")
          .createSignedUrl(path, 120, {
            transform: { width: 1200, height: 630, resize: "contain" },
          });
        if (!signed?.signedUrl) return new Response("Not found", { status: 404 });

        const upstream = await fetch(signed.signedUrl);
        if (!upstream.ok) return new Response("Not found", { status: 404 });

        return new Response(await upstream.arrayBuffer(), {
          status: 200,
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
