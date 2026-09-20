import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

type Coordinate = { lat: number; lon: number; label: string };

async function geocode(address: string): Promise<Coordinate> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", address);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "nl");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "0");
  const response = await fetch(url, {
    headers: {
      "Accept-Language": "nl-NL,nl;q=0.9",
      "User-Agent": "BCD-Ledenapp/1.0 (simone@coffeeshopbond.nl)",
    },
  });
  if (!response.ok) throw new Error("Adresdienst is tijdelijk niet bereikbaar");
  const results = await response.json();
  if (!Array.isArray(results) || !results[0]) throw new Error(`Adres niet gevonden: ${address}`);
  return { lat: Number(results[0].lat), lon: Number(results[0].lon), label: results[0].display_name };
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = request.headers.get("Authorization") || "";
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return json({ error: "Log opnieuw in om een route te berekenen" }, 401);

    const { origin, destination } = await request.json();
    if (typeof origin !== "string" || typeof destination !== "string" || origin.trim().length < 5 || destination.trim().length < 5) {
      return json({ error: "Vul twee volledige adressen in" }, 400);
    }
    if (origin.length > 250 || destination.length > 250) return json({ error: "Adres is te lang" }, 400);

    const [from, to] = await Promise.all([geocode(origin.trim()), geocode(destination.trim())]);
    const routeUrl = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false&alternatives=false&steps=false`;
    const routeResponse = await fetch(routeUrl, { headers: { "User-Agent": "BCD-Ledenapp/1.0" } });
    if (!routeResponse.ok) throw new Error("Routeberekening is tijdelijk niet bereikbaar");
    const route = await routeResponse.json();
    const metres = route?.routes?.[0]?.distance;
    if (!Number.isFinite(metres)) throw new Error("Er kon geen autoroute tussen deze adressen worden gevonden");

    return json({
      one_way_km: Math.round((metres / 1000) * 10) / 10,
      origin: from.label,
      destination: to.label,
    });
  } catch (error) {
    console.error("calculate-route", error);
    return json({ error: error instanceof Error ? error.message : "Route kon niet worden berekend" }, 400);
  }
});
