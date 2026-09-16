import { createFileRoute } from "@tanstack/react-router";

/**
 * Logo van één lid. De bucket blijft privé; alleen het logo zelf is openbaar
 * bereikbaar via deze route, zodat het ook zonder inloggen getoond kan worden.
 */
export const Route = createFileRoute("/api/public/member-logo/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = Number((params.id ?? "").replace(/[^0-9]/g, ""));
        if (!Number.isFinite(id) || id <= 0) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: files } = await supabaseAdmin.storage
          .from("member-logos")
          .list(String(id), { limit: 20 });
        const logo = (files ?? []).find((f) => f.id && f.name.startsWith("logo."));
        if (!logo) return new Response("Not found", { status: 404 });

        const { data: signed } = await supabaseAdmin.storage
          .from("member-logos")
          .createSignedUrl(`${id}/${logo.name}`, 120);
        if (!signed?.signedUrl) return new Response("Not found", { status: 404 });

        const upstream = await fetch(signed.signedUrl);
        if (!upstream.ok) return new Response("Not found", { status: 404 });

        return new Response(await upstream.arrayBuffer(), {
          status: 200,
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "image/png",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
