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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: members, error: mErr } = await supabase
      .from("members_data")
      .select("data")
      .eq("member_type", "member");
    if (mErr) throw mErr;

    const gemeenten = new Set<string>();
    const provincies = new Set<string>();
    const uniekeLocaties = new Set<string>();
    for (const m of members ?? []) {
      const d = m.data as any;
      const plaats = d?.plaats as string | undefined;
      if (Array.isArray(d?.locaties) && d.locaties.length > 0) {
        for (const loc of d.locaties) {
          const key = [
            String(loc?.naam ?? "").trim().toLowerCase(),
            String(loc?.adres ?? "").trim().toLowerCase(),
            String(loc?.plaats ?? plaats ?? "").trim().toLowerCase(),
          ].join("|");
          uniekeLocaties.add(key || `member-${m.id}-${uniekeLocaties.size}`);
        }
      } else {
        // Fallback: member without locaties array — use aantalLocaties field
        const n = Number(d?.aantalLocaties);
        for (let i = 0; i < (Number.isFinite(n) && n > 0 ? n : 0); i++) {
          uniekeLocaties.add(`member-${m.id}-fallback-${i}`);
        }
      }
      if (plaats) {
        gemeenten.add(plaats);
        const prov = PLAATS_TO_PROVINCIE[plaats];
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
      aantal_coffeeshops: uniekeLocaties.size,
      aantal_gemeenten: gemeenten.size,
      aantal_provincies: provincies.size,
      aantal_bestuursleden: board?.length ?? 0,
      oprichtingsjaar: 1994,
      bestuur,
      laatst_bijgewerkt: new Date().toISOString(),
    };

    return new Response(JSON.stringify(payload), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
      status: 200,
    });
  } catch (e) {
    console.error("public-stats error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});