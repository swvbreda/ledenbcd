import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Haalt het landelijke coffeeshopregister op uit het project "Coffeeshopbeleid"
 * en zet het om naar lokale tabellen, inclusief automatische matching op leden.
 *
 * Met BCD_KOPPEL_SLEUTEL wordt het beveiligde export-eindpunt gebruikt.
 * Alleen wanneer dat eindpunt niet bestaat, wordt de openbare REST-route
 * geprobeerd. Autorisatiefouten mogen niet stil naar die route terugvallen.
 */

const SOURCE_URL = "https://dilxcjjsvpxrkjrnivla.supabase.co";
const SOURCE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpbHhjampzdnB4cmtqcm5pdmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjcxNzgsImV4cCI6MjA5NDM0MzE3OH0.l7dN6P3FmCN-pD7ev5bqc46ZH7hjWaRq1YNhrN3NWRM";
// Instelbaar; het .nl-domein serveert een certificaat dat daar niet geldig voor is.
const SOURCE_APP_URL = (
  Deno.env.get("BELEIDSMONITOR_BASE_URL") ?? "https://coffeeshopbeleid.com"
).replace(/\/+$/, "");
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

type SecureExport = {
  shops: SourceShop[];
  gemeenten: Array<{ id: string; naam: string; provincie: string | null }>;
};

/** Beveiligd export-eindpunt van Coffeeshopbeleid. */
async function fetchSecureExport(secret: string): Promise<SecureExport | null> {
  const res = await fetch(`${SOURCE_APP_URL}/api/public/hooks/bcd-register-export`, {
    headers: { "x-bcd-sleutel": secret },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Export-eindpunt gaf ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  return {
    shops: json.coffeeshops ?? json.shops ?? json.data ?? [],
    gemeenten: json.gemeenten ?? [],
  };
}

/**
 * Coffeeshopbeleid heeft daarnaast een beveiligd ledendossier-endpoint. Dat
 * bevat de door de bron zelf bevestigde vergunningkoppeling en UBO-keten. Het
 * wordt als aanvulling gebruikt wanneer de volledige registerexport nog niet
 * beschikbaar is.
 */
async function fetchLinkedDossiers(secret: string): Promise<any[]> {
  const res = await fetch(`${SOURCE_APP_URL}/api/public/leden-dossier`, {
    headers: { "x-bcd-sleutel": secret },
  });
  if (res.status === 404) return [];
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ledendossier-endpoint gaf ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = await res.json();
  return json.leden ?? json.data ?? [];
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
    const secret = Deno.env.get("BCD_KOPPEL_SLEUTEL") ?? Deno.env.get("COFFEESHOPBELEID_API_SECRET");
    let shops: SourceShop[] | null = null;
    let secureGemeenten: SecureExport["gemeenten"] = [];
    let linkedDossiers: any[] = [];
    let uboBron: "export" | "geen" = "geen";

    if (secret) {
      const secureExport = await fetchSecureExport(secret);
      shops = secureExport?.shops ?? null;
      secureGemeenten = secureExport?.gemeenten ?? [];
      if (shops) uboBron = "export";
      try {
        linkedDossiers = await fetchLinkedDossiers(secret);
      } catch (e) {
        console.warn("Ledendossier-endpoint niet bereikbaar:", e);
        linkedDossiers = [];
      }
    }

    let gemeenteById = new Map<string, { naam: string; provincie: string | null }>();
    if (!shops) {
      // Terugval: openbare registergegevens zonder UBO.
      let bronShops: any[];
      let gemeenten: any[];
      try {
        [bronShops, gemeenten] = await Promise.all([
          fetchAllPublic("coffeeshop_vergunningen", "*"),
          fetchAllPublic("gemeenten", "id,naam,provincie"),
        ]);
      } catch (error) {
        const message = String(error instanceof Error ? error.message : error).slice(0, 500);
        console.warn("Registerbron tijdelijk niet toegankelijk; bestaande gegevens blijven behouden:", message);
        await db.from("coffeeshop_register_sync_state").update({
          last_run_at: new Date().toISOString(),
          last_status: "overgeslagen (bron niet toegankelijk)",
          error_message: message,
          updated_at: new Date().toISOString(),
        }).eq("id", 1);

        return new Response(
          JSON.stringify({
            ok: false,
            degraded: true,
            preservedExistingData: true,
            reason: "Registerbron tijdelijk niet toegankelijk",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      gemeenteById = new Map(
        gemeenten.map((g: any) => [g.id, { naam: g.naam, provincie: g.provincie ?? null }]),
      );
      shops = bronShops;
    } else {
      gemeenteById = new Map(secureGemeenten.map((g) => [g.id, { naam: g.naam, provincie: g.provincie ?? null }]));
      for (const s of shops) {
        if (!s.gemeente_id || gemeenteById.has(s.gemeente_id) || !s.gemeente) continue;
        gemeenteById.set(s.gemeente_id, {
          naam: typeof s.gemeente === "string" ? s.gemeente : s.gemeente?.naam,
          provincie: typeof s.gemeente === "object" ? s.gemeente?.provincie ?? null : s.provincie ?? null,
        });
      }
    }

    const rows = shops.map((s) => {
      const gem = gemeenteById.get(s.gemeente_id);
      const gemeente = canonPlace(gem?.naam ?? (typeof s.gemeente === "string" ? s.gemeente : null));
      return {
        bron_id: s.id,
        naam: s.naam_coffeeshop ?? s.naam ?? "Onbekend",
        straat: s.straat ?? s.adres ?? null,
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
        // Verrijking uit de Beleidsmonitor: alleen echte http(s)-logo's overnemen,
        // data-URI's zijn vaak plaatjes van andere diensten en worden genegeerd.
        logo_url: typeof s.logo_url === "string" && /^https?:\/\//i.test(s.logo_url) ? s.logo_url : null,
        socials: s.socials && typeof s.socials === "object" ? s.socials : null,
        oprichtingsdatum: s.oprichtingsdatum ?? null,
        oprichtingsdatum_bron: s.oprichtingsdatum_bron ?? null,
        shopcode: s.shopcode ?? s.shop_code ?? null,
        bag_pand_id: s.bag_pand_id ?? null,
        bag_verblijfsobject_id: s.bag_verblijfsobject_id ?? null,
        verrijkt_op: s.verrijkt_op ?? null,
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
    if (uboBron === "export" || linkedDossiers.length > 0) {
      const { data: registerRows } = await db.from("coffeeshop_register").select("id,bron_id");
      const idByBron = new Map((registerRows ?? []).map((r: any) => [r.bron_id, r.id]));
      const exportUboRows = shops.flatMap((s) =>
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
      const dossierUboRows = linkedDossiers.flatMap((d: any) => {
        const bronId = d.koppeling?.vergunning_id;
        const registerId = bronId ? idByBron.get(bronId) : null;
        return (d.ubo_keten ?? []).map((u: any) => ({
          register_id: registerId,
          niveau: u.niveau ?? 0,
          naam: u.naam,
          kvk_nummer: u.kvk_nummer ?? null,
          soort: u.soort ?? "rechtspersoon",
          betrouwbaarheid: u.betrouwbaarheid ?? null,
          is_uiteindelijk: !!u.is_uiteindelijk,
          toelichting: u.toelichting ?? null,
        })).filter((u: any) => u.register_id && u.naam);
      });
      const uniek = new Map<string, any>();
      for (const row of [...exportUboRows, ...dossierUboRows]) {
        uniek.set(`${row.register_id}:${row.niveau}:${row.naam}`, row);
      }
      const uboRows = Array.from(uniek.values());
      const geraakteRegisterIds = Array.from(new Set(uboRows.map((row: any) => row.register_id)));
      if (geraakteRegisterIds.length) {
        const { error } = await db
          .from("coffeeshop_register_ubo")
          .delete()
          .in("register_id", geraakteRegisterIds);
        if (error) throw error;
      }
      for (let i = 0; i < uboRows.length; i += 200) {
        const chunk = uboRows.slice(i, i + 200);
        const { error } = await db
          .from("coffeeshop_register_ubo")
          .upsert(chunk, { onConflict: "register_id,niveau,naam" });
        if (error) throw error;
        uboSynced += chunk.length;
      }
      if (dossierUboRows.length > 0) uboBron = "export";
    }

    // ---- Automatische matching op leden ----
    const { data: registerRows } = await db
      .from("coffeeshop_register")
      .select("id,naam,plaats,gemeente,postcode,huisnummer,kvk_nummer,vergunninghouder,exploitant")
      .eq("vervallen", false);
    const { data: memberRows } = await db
      .from("members_data")
      .select("id,data,member_type")
      .in("member_type", ["member", "lead"]);
    const { data: editRows } = await db.from("member_edits").select("member_id,data");
    const editById = new Map((editRows ?? []).map((e: any) => [e.member_id, e.data]));
    const { data: existingLinks } = await db
      .from("coffeeshop_member_links")
      .select("register_id,member_id,status,location_key");
    const linkKey = new Set((existingLinks ?? []).map((l: any) => `${l.register_id}:${l.member_id}`));
    const gekoppeldeShops = new Set(
      (existingLinks ?? []).filter((l: any) => l.status !== "afgewezen").map((l: any) => l.register_id as string),
    );
    const gekoppeldeLocaties = new Set(
      (existingLinks ?? [])
        .filter((l: any) => l.status === "bevestigd" && l.location_key)
        .map((l: any) => `${l.member_id}:${l.location_key}`),
    );


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

    /** Zelfde sleutel als de frontend (naam|adres|postcode, genormaliseerd). */
    const locKey = (loc: any) =>
      [
        String(loc?.naam ?? "").toLowerCase().replace(/[^a-z0-9]/g, ""),
        String(loc?.adres ?? "").toLowerCase().replace(/[^a-z0-9]/g, ""),
        String(loc?.postcode ?? "").toLowerCase().replace(/[^a-z0-9]/g, ""),
      ].join("|");

    type Kandidaat = {
      member_id: number;
      location_key: string;
      echt: boolean;
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
          location_key: locKey(loc),
          echt: !!(String(loc.adres ?? "").trim() || String(loc.plaats ?? "").trim()),
          naam: normName(loc.naam ?? data.naam),
          plaats: normPlace(canonPlace(loc.plaats ?? data.plaats)),
          postcode: normPostcode(loc.postcode),
          huisnummer: (adres.match(/(\d+)/)?.[1] ?? ""),
          kvks: memberKvks,
          bedrijven: memberBedrijven,
        });
      }
    }


    type ShopInfo = {
      id: string;
      naam: string;
      plaats: string;
      gemeente: string;
      postcode: string;
      nummer: string;
      kvk: string;
      kvkLabel: string;
      bedrijven: Map<string, string>;
      ubo: { namen: Set<string>; kvks: Set<string> };
    };

    const shopInfos: ShopInfo[] = (registerRows ?? []).map((shop: any) => {
      const bedrijven = new Map<string, string>(); // genormaliseerd -> label
      for (const [label, waarde] of [
        ["Vergunninghouder", shop.vergunninghouder],
        ["Exploitant", shop.exploitant],
      ] as const) {
        const n = normName(waarde);
        if (n) bedrijven.set(n, `${label}: ${waarde}`);
      }
      return {
        id: shop.id,
        naam: normName(shop.naam),
        plaats: normPlace(canonPlace(shop.plaats)),
        gemeente: normPlace(canonPlace(shop.gemeente)),
        postcode: normPostcode(shop.postcode),
        nummer: String(shop.huisnummer ?? "").replace(/\D/g, ""),
        kvk: normKvk(shop.kvk_nummer),
        kvkLabel: String(shop.kvk_nummer ?? ""),
        bedrijven,
        ubo: uboByRegister.get(shop.id) ?? { namen: new Set<string>(), kvks: new Set<string>() },
      };
    });

    /** Score van één registershop tegen één ledenlocatie. */
    const scoreMatch = (s: ShopInfo, k: Kandidaat): { score: number; reden: string } => {
      const zelfdePlaats = !!s.plaats && !!k.plaats && (s.plaats === k.plaats || s.gemeente === k.plaats);
      const kvkHit = s.kvk && k.kvks.has(s.kvk);
      const bedrijfHit = [...s.bedrijven.keys()].find((n) => k.bedrijven.has(n));
      const uboKvkHit = [...s.ubo.kvks].find((v) => k.kvks.has(v));
      const uboNaamHit = [...s.ubo.namen].find((v) => k.bedrijven.has(v));
      const zelfdeNaam = !!s.naam && !!k.naam && s.naam === k.naam;

      if (s.postcode && k.postcode && s.postcode === k.postcode && s.nummer && k.huisnummer === s.nummer) {
        return { score: 0.95, reden: "Adres (postcode + huisnummer)" };
      }
      if (kvkHit) return { score: 0.95, reden: `KvK ${s.kvkLabel}` };
      if (zelfdeNaam && zelfdePlaats) return { score: 0.9, reden: "Naam + plaats" };
      if (bedrijfHit) return { score: 0.85, reden: s.bedrijven.get(bedrijfHit)! };
      if (uboKvkHit || uboNaamHit) return { score: 0.75, reden: "UBO/eigendomsketen komt overeen" };
      // Zelfde naam maar andere plaats: geen voorstel (te veel valse matches).
      return { score: 0, reden: "" };
    };

    const nieuweLinks: any[] = [];
    const claimedShops = new Set<string>(gekoppeldeShops);
    const claimedLocaties = new Set<string>(gekoppeldeLocaties);

    // Ronde 1: vanuit elke registershop het best passende lid zoeken.
    for (const s of shopInfos) {
      let best: { k: Kandidaat; score: number; reden: string } | null = null;
      let besteLeden = new Set<number>(); // leden met dezelfde topscore (uniciteitscheck)
      for (const k of kandidaten) {
        const { score, reden } = scoreMatch(s, k);
        if (score === 0) continue;
        if (score > (best?.score ?? 0)) {
          best = { k, score, reden };
          besteLeden = new Set([k.member_id]);
        } else if (best && score === best.score) {
          besteLeden.add(k.member_id);
        }
      }

      if (best && best.score >= 0.6 && !linkKey.has(`${s.id}:${best.k.member_id}`)) {
        // Alleen automatisch bevestigen bij hoge zekerheid én een unieke kandidaat.
        const uniek = besteLeden.size === 1;
        const bevestigd = best.score >= 0.9 && uniek;
        nieuweLinks.push({
          register_id: s.id,
          member_id: best.k.member_id,
          location_key: best.k.location_key,
          match_score: best.score,
          match_reden: best.reden,
          status: bevestigd ? "bevestigd" : "voorstel",
          bevestigd_op: bevestigd ? new Date().toISOString() : null,
        });
        claimedShops.add(s.id);
        if (bevestigd) claimedLocaties.add(`${best.k.member_id}:${best.k.location_key}`);
      }
    }

    // Ronde 2: vanuit elke nog ongekoppelde ledenlocatie de best passende vrije registershop zoeken.
    const openKandidaten = kandidaten.filter(
      (k) => k.echt && !claimedLocaties.has(`${k.member_id}:${k.location_key}`),
    );
    for (const k of openKandidaten) {
      let best: { s: ShopInfo; score: number; reden: string } | null = null;
      let aantalTop = 0;
      for (const s of shopInfos) {
        if (claimedShops.has(s.id)) continue;
        if (linkKey.has(`${s.id}:${k.member_id}`)) continue;
        const { score, reden } = scoreMatch(s, k);
        if (score === 0) continue;
        if (score > (best?.score ?? 0)) {
          best = { s, score, reden };
          aantalTop = 1;
        } else if (best && score === best.score) {
          aantalTop++;
        }
      }
      if (!best || best.score < 0.6) continue;
      const bevestigd = best.score >= 0.9 && aantalTop === 1;
      nieuweLinks.push({
        register_id: best.s.id,
        member_id: k.member_id,
        location_key: k.location_key,
        match_score: best.score,
        match_reden: `${best.reden} (vanuit ledenlocatie)`,
        status: bevestigd ? "bevestigd" : "voorstel",
        bevestigd_op: bevestigd ? new Date().toISOString() : null,
      });
      claimedShops.add(best.s.id);
      if (bevestigd) claimedLocaties.add(`${k.member_id}:${k.location_key}`);
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
