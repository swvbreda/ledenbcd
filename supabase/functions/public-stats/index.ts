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
      .select("id, data")
      .in("member_type", ["member", "lead"]);
    if (mErr) throw mErr;

    // Merge pending member_edits (matches dashboard logic)
    const { data: edits, error: eErr } = await supabase
      .from("member_edits")
      .select("member_id, data");
    if (eErr) throw eErr;
    const editsMap = new Map<number, any>();
    for (const e of edits ?? []) editsMap.set(e.member_id, e.data);

    const gemeenten = new Set<string>();
    const provincies = new Set<string>();
    let aantalCoffeeshops = 0;
    for (const m of members ?? []) {
      const base = (m.data ?? {}) as any;
      const edit = editsMap.get((m as any).id) ?? {};
      const d = { ...base, ...edit };
      // Arrays merge: prefer edit.locaties when present, else base.locaties
      d.locaties = Array.isArray(edit?.locaties) ? edit.locaties : base?.locaties;
      const plaats = d?.plaats as string | undefined;
      // Match dashboard logic: locaties.length, fallback to aantalLocaties
      const locLen = Array.isArray(d?.locaties) ? d.locaties.length : 0;
      const fallback = Number(d?.aantalLocaties);
      aantalCoffeeshops += locLen > 0 ? locLen : (Number.isFinite(fallback) && fallback > 0 ? fallback : 0);
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
      aantal_coffeeshops: aantalCoffeeshops,
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