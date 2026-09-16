import { createFileRoute } from "@tanstack/react-router";

/**
 * Logo van één coffeeshop uit het register. De bucket blijft privé; alleen het
 * logo van de opgevraagde shop is bereikbaar via deze route.
 */
export const Route = createFileRoute("/api/public/shop-logo/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = (params.id ?? "").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 64);
        if (!id) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: shop } = await supabaseAdmin
          .from("coffeeshop_register")
          .select("logo_pad")
          .eq("id", id)
          .maybeSingle();
        const path = shop?.logo_pad;
        if (!path) return new Response("Not found", { status: 404 });

        const { data: signed } = await supabaseAdmin.storage
          .from("shop-logos")
          .createSignedUrl(path, 120);
        if (!signed?.signedUrl) return new Response("Not found", { status: 404 });

        const upstream = await fetch(signed.signedUrl);
        if (!upstream.ok) return new Response("Not found", { status: 404 });

        return new Response(await upstream.arrayBuffer(), {
          status: 200,
          headers: {
            "Content-Type": upstream.headers.get("content-type") ?? "image/png",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
