import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Haalt het landelijke coffeeshopregister op uit het project "Coffeeshopbeleid"
 * en zet het om naar lokale tabellen, inclusief automatische matching op leden.
 *
 * Zonder COFFEESHOPBELEID_API_SECRET gebruikt de functie de openbaar leesbare
 * REST-tabellen (zonder UBO-keten). Met het geheim wordt het beveiligde
 * export-eindpunt gebruikt, dat ook de eigendomsketen teruggeeft.
 */

const SOURCE_URL = "https://dilxcjjsvpxrkjrnivla.supabase.co";
const SOURCE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpbHhjampzdnB4cmtqcm5pdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjcxNzgsImV4cCI6MjA5NDM0MzE3OH0.l7dN6P3FmCN-pD7ev5bqc46ZH7hjWaRq1YNhrN3NWRM";
const SOURCE_APP_URL = "https://coffeeshopbeleid.nl";
const PAGE_SIZE = 500;

type SourceShop = Record<string, any>;

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Naam normaliseren voor matching: kleine letters, zonder ruis. */
function normName(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bcoffeeshop\b|\bcoffee\s?shop\b|\bshop\b/g, " ")
    .replace(/\b(b\.?v\.?|v\.?o\.?f\.?|holding)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normPlace(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

/** KvK-nummer normaliseren: alleen cijfers, 8-cijferig. */
function normKvk(value: string | number | null | undefined): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 8 ? digits : "";
}


/** Schrijfwijzen gelijktrekken: krulapostrof, provincie-suffix, bekende synoniemen. */
const PLACE_SYNONYMS: Record<string, string> = {
  "'s-gravenhage": "Den Haag",
  "s-gravenhage": "Den Haag",
  "den haag": "Den Haag",
  "'s-hertogenbosch": "'s-Hertogenbosch",
  "s-hertogenbosch": "'s-Hertogenbosch",
  "den bosch": "'s-Hertogenbosch",
};

function canonPlace(value: string | null | undefined): string | null {
  let v = (value ?? "").replace(/[‘’´`]/g, "'").replace(/\s+/g, " ").trim();
  if (!v) return null;
  v = v.replace(/\s*\([A-Za-z.\s]+\)\s*$/, "").trim(); // "Hengelo (O.)" -> "Hengelo"
  const key = v.toLowerCase();
  return PLACE_SYNONYMS[key] ?? v;
}


function normPostcode(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function fetchAllPublic(table: string, select: string): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await fetch(
      `${SOURCE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=id.asc&offset=${offset}&limit=${PAGE_SIZE}`,
      { headers: { apikey: SOURCE_ANON_KEY, Authorization: `Bearer ${SOURCE_ANON_KEY}` } },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Bron ${table} gaf ${res.status}: ${body.slice(0, 300)}`);
    }
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

/** Beveiligd export-eindpunt (inclusief UBO) van het bronproject. */
async function fetchSecureExport(secret: string): Promise<SourceShop[] | null> {
  const shops: SourceShop[] = [];
  for (let page = 0; ; page++) {
    const res = await fetch(
      `${SOURCE_APP_URL}/api/public/hooks/bcd-register-export?page=${page}&limit=${PAGE_SIZE}`,
      { headers: { "x-bcd-secret": secret } },
    );
    if (res.status === 404) return null; // eindpunt bestaat nog niet
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Export-eindpunt gaf ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = await res.json();
    const batch: SourceShop[] = json.shops ?? json.data ?? [];
    shops.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return shops;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Alleen aanroepbaar met het interne geheim of de service-role sleutel.
  const internal = Deno.env.get("INTERNAL_WEBHOOK_SECRET");
  const auth = req.headers.get("authorization") ?? "";
  const providedInternal = req.headers.get("x-internal-secret");
  const isService = auth === `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`;
  if (!isService && (!internal || providedInternal !== internal)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const db = admin();
  let shopsSynced = 0;
  let uboSynced = 0;
  let linksProposed = 0;

  try {
    const secret = Deno.env.get("COFFEESHOPBELEID_API_SECRET");
    let shops: SourceShop[] | null = null;
    let uboBron: "export" | "geen" = "geen";

    if (secret) {
      shops = await fetchSecureExport(secret);
      if (shops) uboBron = "export";
    }

    let gemeenteById = new Map<string, { naam: string; provincie: string | null }>();
    if (!shops) {
      // Terugval: openbare registergegevens zonder UBO.
      const [bronShops, gemeenten] = await Promise.all([
        fetchAllPublic("coffeeshop_vergunningen", "*"),
        fetchAllPublic("gemeenten", "id,naam,provincie"),
      ]);
      gemeenteById = new Map(
        gemeenten.map((g: any) => [g.id, { naam: g.naam, provincie: g.provincie ?? null }]),
      );
      shops = bronShops;
    } else {
      gemeenteById = new Map(
        shops
          .filter((s) => s.gemeente_id && s.gemeente)
          .map((s) => [
            s.gemeente_id,
            {
              naam: typeof s.gemeente === "string" ? s.gemeente : s.gemeente?.naam,
              provincie: typeof s.gemeente === "object" ? s.gemeente?.provincie ?? null : s.provincie ?? null,
            },
          ]),
      );
    }

    const rows = shops.map((s) => {
      const gem = gemeenteById.get(s.gemeente_id);
      const gemeente = canonPlace(gem?.naam ?? (typeof s.gemeente === "string" ? s.gemeente : null));
      return {
        bron_id: s.id,
        naam: s.naam_coffeeshop ?? s.naam ?? "Onbekend",
        straat: s.straat ?? null,
        huisnummer: s.huisnummer ?? null,
        huisnummer_toevoeging: s.huisnummer_toevoeging ?? null,
        postcode: s.postcode ?? null,
        plaats: canonPlace(s.plaats) ?? gemeente,
        gemeente,
        provincie: gem?.provincie ?? null,
        latitude: s.latitude ?? null,
        longitude: s.longitude ?? null,
        exploitant: s.exploitant ?? null,
        vergunninghouder: s.vergunninghouder ?? null,
        vergunningnummer: s.vergunningnummer ?? null,
        status: s.status ?? "actief",
        vergunningverlening: s.vergunningverlening ?? null,
        einddatum: s.einddatum ?? null,
        website: s.website ?? null,
        telefoon: s.telefoon ?? null,
        raw: s,
        vervallen: false,
        synced_at: new Date().toISOString(),
      };
    });

    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await db.from("coffeeshop_register").upsert(chunk, { onConflict: "bron_id" });
      if (error) throw error;
      shopsSynced += chunk.length;
    }

    // Bronrecords die niet meer voorkomen markeren als vervallen.
    const bronIds = new Set(rows.map((r) => r.bron_id));
    const { data: bestaand } = await db.from("coffeeshop_register").select("id,bron_id,vervallen");
    const verdwenen = (bestaand ?? []).filter((r: any) => !bronIds.has(r.bron_id) && !r.vervallen);
    if (verdwenen.length) {
      await db
        .from("coffeeshop_register")
        .update({ vervallen: true })
        .in("id", verdwenen.map((r: any) => r.id));
    }

    // UBO-keten (alleen beschikbaar via het beveiligde eindpunt).
    if (uboBron === "export") {
      const { data: registerRows } = await db.from("coffeeshop_register").select("id,bron_id");
      const idByBron = new Map((registerRows ?? []).map((r: any) => [r.bron_id, r.id]));
      const uboRows = shops.flatMap((s) =>
        (s.ubo_keten ?? s.ubo ?? []).map((u: any) => ({
          register_id: idByBron.get(s.id),
          niveau: u.niveau ?? 0,
          naam: u.naam,
          kvk_nummer: u.kvk_nummer ?? null,
          soort: u.soort ?? "rechtspersoon",
          betrouwbaarheid: u.betrouwbaarheid ?? null,
          is_uiteindelijk: !!u.is_uiteindelijk,
          toelichting: u.toelichting ?? null,
        })).filter((u: any) => u.register_id && u.naam),
      );
      for (let i = 0; i < uboRows.length; i += 200) {
        const chunk = uboRows.slice(i, i + 200);
        const { error } = await db
          .from("coffeeshop_register_ubo")
          .upsert(chunk, { onConflict: "register_id,niveau,naam" });
        if (error) throw error;
        uboSynced += chunk.length;
      }
    }

    // ---- Automatische matching op leden ----
    const { data: registerRows } = await db
      .from("coffeeshop_register")
      .select("id,naam,plaats,gemeente,postcode,huisnummer,kvk_nummer,vergunninghouder,exploitant")
      .eq("vervallen", false);
    const { data: memberRows } = await db
      .from("members_data")
      .select("id,data")
      .eq("member_type", "member");
    const { data: editRows } = await db.from("member_edits").select("member_id,data");
    const editById = new Map((editRows ?? []).map((e: any) => [e.member_id, e.data]));
    const { data: existingLinks } = await db
      .from("coffeeshop_member_links")
      .select("register_id,member_id");
    const linkKey = new Set((existingLinks ?? []).map((l: any) => `${l.register_id}:${l.member_id}`));

    // UBO-keten per registershop (leeg zolang het beveiligde eindpunt niet gebruikt wordt).
    const { data: uboAll } = await db
      .from("coffeeshop_register_ubo")
      .select("register_id,naam,kvk_nummer");
    const uboByRegister = new Map<string, { namen: Set<string>; kvks: Set<string> }>();
    for (const u of uboAll ?? []) {
      const key = (u as any).register_id as string;
      if (!uboByRegister.has(key)) uboByRegister.set(key, { namen: new Set(), kvks: new Set() });
      const bucket = uboByRegister.get(key)!;
      const n = normName((u as any).naam);
      if (n) bucket.namen.add(n);
      const k = normKvk((u as any).kvk_nummer);
      if (k) bucket.kvks.add(k);
    }

    type Kandidaat = {
      member_id: number;
      naam: string;
      plaats: string;
      postcode: string;
      huisnummer: string;
      kvks: Set<string>;
      bedrijven: Set<string>;
    };
    const kandidaten: Kandidaat[] = [];
    for (const m of memberRows ?? []) {
      const data = { ...(m as any).data, ...(editById.get((m as any).id) ?? {}) };
      const locaties = Array.isArray(data.locaties) && data.locaties.length
        ? data.locaties
        : [{ naam: data.naam, plaats: data.plaats, postcode: data.postcode, adres: data.adres }];
      // Bedrijfsnamen en KvK-nummers gelden voor het hele lid (BV kan meerdere shops houden).
      const memberBedrijven = new Set<string>();
      for (const v of [data.bedrijfsnaam, data.factuurBedrijfsnaam, data.vergunninghouder, data.exploitant]) {
        const n = normName(v);
        if (n) memberBedrijven.add(n);
      }
      const memberKvks = new Set<string>();
      for (const v of [data.kvk, data.kvkNummer, data.factuurKvk]) {
        const k = normKvk(v);
        if (k) memberKvks.add(k);
      }
      for (const loc of locaties) {
        for (const v of [loc.bedrijfsnaam, loc.vergunninghouder, loc.exploitant]) {
          const n = normName(v);
          if (n) memberBedrijven.add(n);
        }
        const lk = normKvk(loc.kvk);
        if (lk) memberKvks.add(lk);
      }
      for (const loc of locaties) {
        const adres: string = loc.adres ?? "";
        kandidaten.push({
          member_id: (m as any).id,
          naam: normName(loc.naam ?? data.naam),
          plaats: normPlace(canonPlace(loc.plaats ?? data.plaats)),
          postcode: normPostcode(loc.postcode),
          huisnummer: (adres.match(/(\d+)/)?.[1] ?? ""),
          kvks: memberKvks,
          bedrijven: memberBedrijven,
        });
      }
    }

    const nieuweLinks: any[] = [];
    for (const shop of registerRows ?? []) {
      const sNaam = normName((shop as any).naam);
      const sPlaats = normPlace(canonPlace((shop as any).plaats));
      const sGemeente = normPlace(canonPlace((shop as any).gemeente));
      const sPostcode = normPostcode((shop as any).postcode);
      const sNummer = String((shop as any).huisnummer ?? "").replace(/\D/g, "");
      const sKvk = normKvk((shop as any).kvk_nummer);
      const sBedrijven = new Map<string, string>(); // genormaliseerd -> label
      for (const [label, waarde] of [
        ["Vergunninghouder", (shop as any).vergunninghouder],
        ["Exploitant", (shop as any).exploitant],
      ] as const) {
        const n = normName(waarde);
        if (n) sBedrijven.set(n, `${label}: ${waarde}`);
      }
      const ubo = uboByRegister.get((shop as any).id) ?? { namen: new Set<string>(), kvks: new Set<string>() };

      let best: { member_id: number; score: number; reden: string } | null = null;
      let besteLeden = new Set<number>(); // leden met dezelfde topscore (uniciteitscheck)
      for (const k of kandidaten) {
        let score = 0;
        let reden = "";
        const zelfdePlaats = !!sPlaats && !!k.plaats && (sPlaats === k.plaats || sGemeente === k.plaats);

        const kvkHit = sKvk && k.kvks.has(sKvk);
        const bedrijfHit = [...sBedrijven.keys()].find((n) => k.bedrijven.has(n));
        const uboKvkHit = [...ubo.kvks].find((v) => k.kvks.has(v));
        const uboNaamHit = [...ubo.namen].find((v) => k.bedrijven.has(v));

        if (sPostcode && k.postcode && sPostcode === k.postcode && sNummer && k.huisnummer === sNummer) {
          score = 0.95;
          reden = "Adres (postcode + huisnummer)";
        } else if (kvkHit) {
          score = 0.95;
          reden = `KvK ${(shop as any).kvk_nummer}`;
        } else if (sNaam && k.naam && sNaam === k.naam && zelfdePlaats) {
          score = 0.9;
          reden = "Naam + plaats";
        } else if (bedrijfHit) {
          score = 0.85;
          reden = sBedrijven.get(bedrijfHit)!;
        } else if (uboKvkHit || uboNaamHit) {
          score = 0.75;
          reden = "UBO/eigendomsketen komt overeen";
        } else if (sNaam && k.naam && sNaam === k.naam && zelfdePlaats === false && sPlaats && k.plaats) {
          // Zelfde naam maar andere plaats: geen voorstel meer (te veel valse matches).
          continue;
        } else if (sNaam && k.naam && sNaam === k.naam && zelfdePlaats) {
          score = 0.6;
          reden = "Alleen naam (zelfde plaats)";
        }
        if (score === 0) continue;
        if (score > (best?.score ?? 0)) {
          best = { member_id: k.member_id, score, reden };
          besteLeden = new Set([k.member_id]);
        } else if (best && score === best.score) {
          besteLeden.add(k.member_id);
        }
      }

      if (best && best.score >= 0.6 && !linkKey.has(`${(shop as any).id}:${best.member_id}`)) {
        // Alleen automatisch bevestigen bij hoge zekerheid én een unieke kandidaat.
        const uniek = besteLeden.size === 1;
        nieuweLinks.push({
          register_id: (shop as any).id,
          member_id: best.member_id,
          match_score: best.score,
          match_reden: best.reden,
          status: best.score >= 0.9 && uniek ? "bevestigd" : "voorstel",
          bevestigd_op: best.score >= 0.9 && uniek ? new Date().toISOString() : null,
        });
      }

    }


    for (let i = 0; i < nieuweLinks.length; i += 200) {
      const chunk = nieuweLinks.slice(i, i + 200);
      const { error } = await db
        .from("coffeeshop_member_links")
        .upsert(chunk, { onConflict: "register_id,member_id", ignoreDuplicates: true });
      if (error) throw error;
      linksProposed += chunk.length;
    }

    await db.from("coffeeshop_register_sync_state").update({
      last_run_at: new Date().toISOString(),
      last_status: uboBron === "export" ? "ok (incl. UBO)" : "ok (openbaar, zonder UBO)",
      shops_synced: shopsSynced,
      ubo_synced: uboSynced,
      links_proposed: linksProposed,
      error_message: null,
      updated_at: new Date().toISOString(),
    }).eq("id", 1);

    // Aansluitend ledengegevens aanvullen vanuit het register (best effort).
    try {
      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich-members-from-register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: "{}",
      });
    } catch (e) {
      console.warn("enrichment na sync mislukt:", String(e));
    }

    return new Response(
      JSON.stringify({ ok: true, shopsSynced, uboSynced, linksProposed, uboBron }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("sync-coffeeshopregister mislukt:", err?.message ?? err);
    await db.from("coffeeshop_register_sync_state").update({
      last_run_at: new Date().toISOString(),
      last_status: "fout",
      error_message: String(err?.message ?? err).slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq("id", 1);

    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
