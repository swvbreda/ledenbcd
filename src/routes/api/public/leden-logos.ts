import { createFileRoute } from "@tanstack/react-router";

/**
 * Logowand van aangesloten coffeeshops voor coffeeshopbond.nl.
 * Deelt uitsluitend naam, plaats en een logo-adres — verder geen ledengegevens.
 * Een lid kan zich afmelden via de tabel shop_logo_optout.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const LOGO_BASE = "https://leden.coffeeshopbond.nl/api/public/shop-logo";

type ShopRow = {
  id: string;
  naam: string | null;
  plaats: string | null;
  logo_pad: string | null;
  logo_url: string | null;
  vervallen: boolean | null;
};

export const Route = createFileRoute("/api/public/leden-logos")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const [{ data: links, error: linkError }, { data: optouts, error: optoutError }] =
          await Promise.all([
            supabaseAdmin
              .from("coffeeshop_member_links")
              .select(
                "register_id, coffeeshop_register(id, naam, plaats, logo_pad, logo_url, vervallen)",
              )
              .eq("status", "bevestigd"),
            supabaseAdmin.from("shop_logo_optout").select("register_id"),
          ]);

        if (linkError || optoutError) {
          console.error("leden-logos", linkError ?? optoutError);
          return new Response(JSON.stringify([]), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const uitgezet = new Set((optouts ?? []).map((o) => o.register_id));
        const perShop = new Map<string, { naam: string; plaats: string; logo_url: string }>();

        for (const link of links ?? []) {
          const shop = (link as unknown as { coffeeshop_register: ShopRow | null })
            .coffeeshop_register;
          if (!shop || shop.vervallen) continue;
          if (!shop.logo_pad && !shop.logo_url) continue;
          if (uitgezet.has(shop.id) || perShop.has(shop.id)) continue;
          perShop.set(shop.id, {
            naam: shop.naam ?? "",
            plaats: shop.plaats ?? "",
            logo_url: `${LOGO_BASE}/${shop.id}`,
          });
        }

        const logos = [...perShop.values()].sort((a, b) => a.naam.localeCompare(b.naam, "nl"));

        return new Response(JSON.stringify(logos), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=300, s-maxage=300",
          },
        });
      },
    },
  },
});
