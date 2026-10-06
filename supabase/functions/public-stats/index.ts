import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const PLAATS_TO_PROVINCIE: Record<string, string> = {
  // Noord-Holland
  Alkmaar: "Noord-Holland", Amsterdam: "Noord-Holland", Beverwijk: "Noord-Holland",
  Bussum: "Noord-Holland", Haarlem: "Noord-Holland", Hilversum: "Noord-Holland",
  Hoorn: "Noord-Holland", Purmerend: "Noord-Holland", Schagen: "Noord-Holland",
  Zandvoort: "Noord-Holland",
  // Utrecht
  Amersfoort: "Utrecht", Driebergen: "Utrecht", Utrecht: "Utrecht", Woerden: "Utrecht",
  // Gelderland
  Apeldoorn: "Gelderland", Arnhem: "Gelderland", Nijmegen: "Gelderland",
  // Overijssel
  Deventer: "Overijssel", Hengelo: "Overijssel", Enschede: "Overijssel",
  Zwolle: "Overijssel", Steenwijk: "Overijssel",
  // Zeeland
  Goes: "Zeeland",
  // Zuid-Holland
  Gouda: "Zuid-Holland", "Den Haag": "Zuid-Holland", Leiden: "Zuid-Holland",
  Rotterdam: "Zuid-Holland", Vlaardingen: "Zuid-Holland",
  "Voorne aan Zee": "Zuid-Holland", Zwijndrecht: "Zuid-Holland",
  // Groningen
  Hoogezand: "Groningen",
  // Friesland
  Leeuwarden: "Friesland",
  // Limburg
  Maastricht: "Limburg",
  // Noord-Brabant
  Eindhoven: "Noord-Brabant", Oss: "Noord-Brabant", Tilburg: "Noord-Brabant",
};

// Per-instance cache: de representatieberekening is zwaar; deel het resultaat
// tussen aanvragen en serveer bij een database-timeout de laatst bekende cijfers.
const CACHE_MS = 60_000;
let cached: { at: number; body: string } | null = null;

const jsonResponse = (body: string, extra: Record<string, string> = {}) =>
  new Response(body, {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=60, s-maxage=60", ...extra },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (cached && Date.now() - cached.at < CACHE_MS) return jsonResponse(cached.body, { "X-Stats-Cache": "hit" });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let representationRows: any[] | null = null;
    let representationError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await supabase.rpc("get_representation_stats");
      representationRows = res.data as any[] | null;
      representationError = res.error;
      if (!res.error) break;
    }
    if (representationError) throw representationError;

    const gemeenten = new Set<string>();
    const provincies = new Set<string>();
    let aantalCoffeeshops = 0;
    let aantalLandelijk = 0;
    let gekoppeldeRegistershops = 0;
    let nietGekoppeldeLocaties = 0;
    let koppelingenZonderVestiging = 0;
    const vertegenwoordigingPerGemeente: Record<string, number> = {};
    const landelijkPerGemeente: Record<string, number> = {};

    for (const row of representationRows ?? []) {
      const gemeente = String(row.gemeente ?? "").trim();
      if (!gemeente) continue;
      const vertegenwoordigd = Number(row.vertegenwoordigde_shops ?? 0);
      const landelijk = Number(row.landelijke_shops ?? 0);
      vertegenwoordigingPerGemeente[gemeente] = vertegenwoordigd;
      // Alleen gemeenten die in het coffeeshopregister voorkomen tellen mee als
      // landelijke coffeeshopgemeente (noemer voor "aanwezig in gemeenten").
      if (landelijk > 0) landelijkPerGemeente[gemeente] = landelijk;
      aantalCoffeeshops += vertegenwoordigd;
      aantalLandelijk += landelijk;
      gekoppeldeRegistershops += Number(row.gekoppelde_registershops ?? 0);
      nietGekoppeldeLocaties += Number(row.niet_gekoppelde_locaties ?? 0);
      koppelingenZonderVestiging += Number(row.koppelingen_zonder_vestiging ?? 0);

      if (vertegenwoordigd > 0 && landelijk > 0) {
        gemeenten.add(gemeente);
        const prov = PLAATS_TO_PROVINCIE[gemeente];
        if (prov) provincies.add(prov);
      }
    }

    const { data: board, error: bErr } = await supabase
      .from("board_members")
      .select("id, naam, functie")
      .order("sort_order");
    if (bErr) throw bErr;

    const { data: photoList } = await supabase
      .storage.from("bestuur-photos").list("", { limit: 1000 });
    const photoByPrefix = new Map<string, string>();
    for (const f of photoList ?? []) {
      const id = f.name.split(".")[0];
      const { data: pub } = supabase.storage.from("bestuur-photos").getPublicUrl(f.name);
      photoByPrefix.set(id, pub.publicUrl);
    }

    const bestuur = (board ?? []).map((b) => ({
      naam: b.naam,
      rol: b.functie,
      foto_url: photoByPrefix.get(b.id) ?? null,
    }));

    const payload = {
      aantal_coffeeshops: aantalCoffeeshops,
      aantal_landelijk: aantalLandelijk,
      aantal_gemeenten: gemeenten.size,
      aantal_provincies: provincies.size,
      aantal_bestuursleden: board?.length ?? 0,
      oprichtingsjaar: 1994,
      vertegenwoordiging_per_gemeente: vertegenwoordigingPerGemeente,
      landelijk_per_gemeente: landelijkPerGemeente,
      gekoppelde_registershops: gekoppeldeRegistershops,
      niet_gekoppelde_locaties: nietGekoppeldeLocaties,
      koppelingen_zonder_vestiging: koppelingenZonderVestiging,
      bestuur,
      laatst_bijgewerkt: new Date().toISOString(),
    };

    const body = JSON.stringify(payload);
    cached = { at: Date.now(), body };
    return jsonResponse(body);
  } catch (e) {
    console.error("public-stats error", e);
    if (cached) return jsonResponse(cached.body, { "X-Stats-Cache": "stale" });
    return new Response(JSON.stringify({ error: (e as any)?.message ?? "Statistieken tijdelijk niet beschikbaar" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});