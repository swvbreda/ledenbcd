import { createFileRoute } from "@tanstack/react-router";

/**
 * Vult het coffeeshopregister zelf aan, omdat de levering vanuit de
 * Beleidsmonitor alleen naam, adres en vergunninggegevens bevat.
 *
 * 1. KvK: kvk-nummer, oprichtingsdatum, vestigingsnummer en startdatum van de
 *    vestiging. Ook `exploitant` en `oprichtingsdatum` worden aangevuld als die
 *    leeg zijn — bestaande waarden worden nooit overschreven.
 * 2. Website: logo (og:image / apple-touch-icon / favicon) en social-links uit
 *    de website van de shop of van het lid. Het logo wordt opgeslagen in de
 *    bucket `shop-logos` zodat de link blijft werken.
 *
 * Volgorde: shops die aan een lid gekoppeld zijn eerst, daarna de rest.
 * Server-to-server, beveiligd met het interne webhook-geheim.
 */

const KVK_SEARCH = "https://api.kvk.nl/api/v2/zoeken";
const KVK_PROFILE = "https://api.kvk.nl/api/v1/basisprofielen";
const KVK_VESTIGING = "https://api.kvk.nl/api/v1/vestigingsprofielen";
const BUCKET = "shop-logos";
const SITE_URL = "https://leden.coffeeshopbond.nl";
const UA = "Mozilla/5.0 (compatible; BCD-Ledenbestand/1.0; +https://leden.coffeeshopbond.nl)";

const normPc = (v: unknown) => String(v ?? "").toUpperCase().replace(/\s+/g, "");
const compact = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Huisnummer van de shop. Het register levert het huisnummer meestal niet apart
 * aan, maar als onderdeel van de straat ("Marnixstraat 333").
 */
const shopHouseNumber = (shop: any) => {
  const direct = String(shop.huisnummer ?? "").replace(/\D+/g, "");
  if (direct) return direct;
  const m = String(shop.straat ?? "").match(/(\d+)\s*[a-zA-Z]?\s*$/);
  return m?.[1] ?? "";
};

function toIsoDate(raw: unknown): string | null {
  const s = String(raw ?? "").replace(/-/g, "");
  if (s.length !== 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Zoekt de vestiging op postcode + huisnummer en levert onderneming,
 * vestigingsnummer, handelsnaam en startdatums. Alleen bij precies één
 * vestiging op dat adres, anders blijft het leeg (liever niets dan fout).
 */
async function kvkLookup(apiKey: string, shop: any) {
  const leeg = {
    kvkNummer: null as string | null,
    handelsnaam: null as string | null,
    vestigingsnummer: null as string | null,
    vestigingDatum: null as string | null,
    bedrijfDatum: null as string | null,
  };
  const headers = { apikey: apiKey, Accept: "application/json" };
  const postcode = normPc(shop.postcode);
  const huisnummer = shopHouseNumber(shop);
  if (!postcode || !huisnummer) return leeg;

  const params = new URLSearchParams({ postcode, huisnummer });
  const res = await fetch(`${KVK_SEARCH}?${params}`, { headers });
  if (!res.ok) return leeg;
  const json: any = await res.json().catch(() => null);

  // Alleen echte vestigingen; rechtspersonen en VvE's op hetzelfde adres negeren.
  const items: any[] = (json?.resultaten ?? []).filter((r: any) => r?.vestigingsnummer);
  const uniek = Array.from(new Map(items.map((r: any) => [String(r.vestigingsnummer), r])).values());
  if (uniek.length !== 1) return leeg;

  const hit: any = uniek[0];
  const kvkNummer = hit?.kvkNummer ? String(hit.kvkNummer) : null;
  const vestigingsnummer = String(hit.vestigingsnummer);
  const handelsnaam = hit?.naam ? String(hit.naam) : null;

  let vestigingDatum: string | null = null;
  const vestRes = await fetch(`${KVK_VESTIGING}/${vestigingsnummer}`, { headers });
  if (vestRes.ok) {
    const prof: any = await vestRes.json().catch(() => null);
    vestigingDatum = toIsoDate(prof?.formeleRegistratiedatum ?? prof?.materieleRegistratie?.datumAanvang);
  }

  let bedrijfDatum: string | null = null;
  if (kvkNummer) {
    const profRes = await fetch(`${KVK_PROFILE}/${kvkNummer}`, { headers });
    if (profRes.ok) {
      const prof: any = await profRes.json().catch(() => null);
      bedrijfDatum = toIsoDate(prof?.formeleRegistratiedatum ?? prof?.materieleRegistratie?.datumAanvang);
    }
  }

  return { kvkNummer, handelsnaam, vestigingsnummer, vestigingDatum, bedrijfDatum };
}

/**
 * Zoekt de logo-kandidaten en socials van de site. De keuze zelf gebeurt in
 * `bestLogoImage`: een echt (niet-vierkant) logo gaat vóór een website-icoontje.
 */
function parseSite(html: string, baseUrl: string) {
  const info = parseLogoKandidaten(html, baseUrl);
  const kandidaten = info.kandidaten.length ? info.kandidaten : info.fotoUrl ? [info.fotoUrl] : [];
  const logoSoort = info.kandidaten.length ? "logo" : "foto";
  return { kandidaten, logoSoort, socials: info.socials };
}

async function fetchHtml(website: string) {
  const url = website.startsWith("http") ? website : `https://${website}`;
  const res = await withTimeout(
    (signal) =>
      fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal, redirect: "follow" }),
    9000,
  );
  if (!res.ok) return null;
  const html = (await res.text()).slice(0, 400_000);
  return { html, url: res.url || url };
}

async function fetchSiteInfo(website: string) {
  const page = await fetchHtml(website);
  if (!page) return null;
  return parseSite(page.html, page.url);
}

const PARKED = /(domein|domain)[^<]{0,40}(te koop|for sale)|this domain is for sale|parkeerpagina/i;

/**
 * Zoekt de website van een shop zonder website: probeert een paar voor de hand
 * liggende domeinnamen op basis van de shopnaam en accepteert die alleen als de
 * pagina echt over deze coffeeshop gaat (naam of plaats komt erin voor).
 */
async function discoverWebsite(shop: any): Promise<{ website: string; html: string; url: string } | null> {
  const woorden = String(shop.naam ?? "")
    .toLowerCase()
    .replace(/coffeeshop|coffee shop|the\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!woorden.length) return null;

  const basis = woorden.join("");
  if (basis.length < 4) return null;
  const metStreepjes = woorden.join("-");
  const kandidaten = Array.from(
    new Set([
      `https://${basis}.nl`,
      metStreepjes !== basis ? `https://${metStreepjes}.nl` : null,
      `https://coffeeshop${basis}.nl`,
    ].filter(Boolean) as string[]),
  ).slice(0, 3);

  const plaats = compact(shop.plaats);
  for (const kandidaat of kandidaten) {
    try {
      const page = await fetchHtml(kandidaat);
      if (!page) continue;
      const tekst = page.html.toLowerCase();
      if (PARKED.test(tekst)) continue;
      const platte = compact(tekst);
      const naamHit = woorden.every((w) => platte.includes(w));
      const plaatsHit = !!plaats && platte.includes(plaats);
      const coffeeshopHit = /coffeeshop|cannabis|wietmenu|weed/i.test(tekst);
      if (naamHit && (plaatsHit || coffeeshopHit)) {
        return { website: kandidaat, html: page.html, url: page.url };
      }
    } catch {
      // domein bestaat niet of reageert niet — gewoon doorgaan
    }
  }
  return null;
}

async function storeLogo(db: any, shopId: string, logoUrl: string) {
  const res = await withTimeout(
    (signal) => fetch(logoUrl, { headers: { "User-Agent": UA }, signal, redirect: "follow" }),
    9000,
  );
  if (!res.ok) return null;
  const type = (res.headers.get("content-type") ?? "").split(";")[0] ?? "";
  if (!/^image\//i.test(type)) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength < 500 || buf.byteLength > 3_000_000) return null;

  const ext = type.includes("png")
    ? "png"
    : type.includes("svg")
      ? "svg"
      : type.includes("webp")
        ? "webp"
        : type.includes("icon")
          ? "ico"
          : "jpg";
  const path = `${shopId}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(path, buf, { contentType: type, upsert: true });
  if (error) {
    console.warn("logo opslaan mislukt", shopId, error.message);
    return null;
  }
  // De bucket is privé; het logo wordt geleverd via de openbare afbeeldingsroute.
  return { url: `${SITE_URL}/api/public/shop-logo/${shopId}`, path };
}

export const Route = createFileRoute("/api/public/register-enrich")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const internal = process.env["INTERNAL_WEBHOOK_SECRET"];
        if (!internal || request.headers.get("x-internal-secret") !== internal) {
          return new Response("Unauthorized", { status: 401 });
        }

        const body: any = await request.json().catch(() => ({}));
        const kvkLimit = Number.isFinite(Number(body?.kvk_limit)) ? Number(body.kvk_limit) : 50;
        const webLimit = Number.isFinite(Number(body?.web_limit)) ? Number(body.web_limit) : 25;
        const onlyMembers = body?.only_members === true;

        const kvkKey = process.env["KVK_API_KEY"] ?? "";
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

        try {
          const { data: shops, error: shopErr } = await db
            .from("coffeeshop_register")
            .select("*")
            .eq("vervallen", false);
          if (shopErr) throw shopErr;

          const { data: links } = await db
            .from("coffeeshop_member_links")
            .select("register_id, member_id, location_key")
            .eq("status", "bevestigd");

          const memberIdByShop = new Map<string, number>();
          for (const l of links ?? []) memberIdByShop.set(l.register_id as string, l.member_id as number);

          // Website uit het ledenbestand wanneer het register er geen heeft
          const websiteByShop = new Map<string, string>();
          const memberIds = Array.from(new Set(Array.from(memberIdByShop.values())));
          if (memberIds.length) {
            const { data: members } = await db.from("members_data").select("id, data").in("id", memberIds);
            const byMember = new Map<number, any>((members ?? []).map((m: any) => [m.id, m.data ?? {}]));
            for (const l of links ?? []) {
              const data = byMember.get(l.member_id as number);
              if (!data) continue;
              const locaties: any[] = Array.isArray(data.locaties) ? data.locaties : [];
              const key = String((l as any).location_key ?? "");
              const [, adres, postcode] = key.split("|");
              const loc =
                locaties.find(
                  (x) => [compact(x?.naam), compact(x?.adres), compact(x?.postcode)].join("|") === key,
                ) ??
                locaties.find((x) => !!adres && compact(x?.adres) === adres) ??
                locaties.find((x) => !!postcode && compact(x?.postcode) === postcode) ??
                (locaties.length === 1 ? locaties[0] : null);
              const site = String(loc?.website ?? data.website ?? "").trim();
              if (site) websiteByShop.set(l.register_id as string, site);
            }
          }

          // Shops van leden eerst
          const ordered = ((shops ?? []) as any[])
            .filter((s) => (onlyMembers ? memberIdByShop.has(s.id) : true))
            .sort((a, b) => Number(memberIdByShop.has(b.id)) - Number(memberIdByShop.has(a.id)));

          let kvkLookups = 0;
          let vestigingLookups = 0;
          let sitesChecked = 0;
          let logosStored = 0;
          let socialsFound = 0;

          if (kvkKey) {
            const todo = ordered
              .filter((s) => !s.kvk_checked_at || !s.kvk_vestiging_checked_at)
              .slice(0, kvkLimit);
            for (const shop of todo) {
              try {
                const { kvkNummer, handelsnaam, vestigingsnummer, vestigingDatum, bedrijfDatum } =
                  await kvkLookup(kvkKey, shop);
                const now = new Date().toISOString();
                const patch: Record<string, unknown> = {
                  kvk_nummer: kvkNummer ?? shop.kvk_nummer ?? null,
                  kvk_oprichtingsdatum: bedrijfDatum ?? shop.kvk_oprichtingsdatum ?? null,
                  kvk_checked_at: now,
                  kvk_vestigingsnummer: vestigingsnummer ?? shop.kvk_vestigingsnummer ?? null,
                  kvk_vestiging_datum: vestigingDatum ?? shop.kvk_vestiging_datum ?? null,
                  kvk_vestiging_checked_at: now,
                };
                if (!shop.exploitant && handelsnaam) patch["exploitant"] = handelsnaam;
                // De startdatum van deze vestiging is leidend voor het register
                const opricht = vestigingDatum ?? bedrijfDatum;
                if (!shop.oprichtingsdatum && opricht) {
                  patch["oprichtingsdatum"] = opricht;
                  patch["oprichtingsdatum_bron"] = vestigingDatum ? "kvk-vestiging" : "kvk";
                }
                await db.from("coffeeshop_register").update(patch as any).eq("id", shop.id);
                Object.assign(shop, patch);
                kvkLookups++;
                if (vestigingsnummer) vestigingLookups++;
              } catch (e) {
                console.warn("KvK lookup fout", shop.id, String(e));
              }
            }
          }

          // Shops zonder logo: bekende website eerst, daarna zelf een website zoeken.
          // Shops die eerder niets opleverden, worden na 60 dagen opnieuw bekeken.
          const herkans = Date.now() - 60 * 24 * 60 * 60 * 1000;
          const webTodo = ordered
            .filter(
              (s) =>
                !s.logo_url &&
                (!s.web_checked_at || new Date(s.web_checked_at).getTime() < herkans),
            )
            .slice(0, webLimit);

          let websitesFound = 0;

          for (const shop of webTodo) {
            const website = String(shop.website ?? websiteByShop.get(shop.id) ?? "").trim();
            const patch: Record<string, unknown> = {
              web_checked_at: new Date().toISOString(),
              verrijkt_op: new Date().toISOString(),
            };
            if (!shop.website && website) patch["website"] = website;
            try {
              sitesChecked++;
              let info = website ? await fetchSiteInfo(website) : null;
              if (!info) {
                const gevonden = await discoverWebsite(shop);
                if (gevonden) {
                  patch["website"] = gevonden.website;
                  websitesFound++;
                  info = parseSite(gevonden.html, gevonden.url);
                }
              }
              if (info) {
                if (Object.keys(info.socials).length) {
                  patch["socials"] = { ...(shop.socials ?? {}), ...info.socials };
                  socialsFound++;
                }
                if (info.logo && !shop.logo_url) {
                  const stored = await storeLogo(db, shop.id, info.logo);
                  if (stored?.url) {
                    patch["logo_url"] = stored.url;
                    patch["logo_pad"] = stored.path;
                    patch["logo_bron"] = info.logoSoort === "foto" ? "foto" : "logo";
                    logosStored++;
                  }
                }
              }
            } catch (e) {
              console.warn("website uitlezen mislukt", shop.id, String(e));
            }
            await db.from("coffeeshop_register").update(patch as any).eq("id", shop.id);
          }

          return Response.json({
            ok: true,
            kvkEnabled: !!kvkKey,
            shops: ordered.length,
            kvkLookups,
            vestigingLookups,
            sitesChecked,
            logosStored,
            socialsFound,
            websitesFound,
          });
        } catch (err: any) {
          console.error("register-enrich mislukt:", err?.message ?? err);
          return Response.json({ error: String(err?.message ?? err) }, { status: 500 });
        }
      },
    },
  },
});
