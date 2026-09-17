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
          .select("logo_pad, logo_url")
          .eq("id", id)
          .maybeSingle();
        const path = shop?.logo_pad;

        // Sommige shops hebben alleen een logo-webadres uit het register en geen
        // opgeslagen bestand; dan halen we het logo rechtstreeks bij die bron op.
        let bronUrl: string | null = null;
        if (path) {
          const { data: signed } = await supabaseAdmin.storage
            .from("shop-logos")
            .createSignedUrl(path, 120);
          bronUrl = signed?.signedUrl ?? null;
        } else if (shop?.logo_url && /^https?:\/\//i.test(shop.logo_url)) {
          bronUrl = shop.logo_url;
        }
        if (!bronUrl) return new Response("Not found", { status: 404 });

        const upstream = await fetch(bronUrl);
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
