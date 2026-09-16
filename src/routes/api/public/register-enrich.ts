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

const shopHouseNumber = (shop: any) => String(shop.huisnummer ?? "").replace(/\D+/g, "");

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

/** Onderneming + oprichtingsdatum bij de KvK. */
async function kvkLookup(apiKey: string, shop: any) {
  const headers = { apikey: apiKey, Accept: "application/json" };
  let kvkNummer: string | null = shop.kvk_nummer ?? null;
  let handelsnaam: string | null = null;

  if (!kvkNummer) {
    const params = new URLSearchParams();
    const naam = shop.vergunninghouder || shop.exploitant || shop.naam;
    if (naam) params.set("naam", String(naam));
    if (shop.postcode) params.set("postcode", normPc(shop.postcode));
    if (shopHouseNumber(shop)) params.set("huisnummer", shopHouseNumber(shop));
    if (!params.toString()) return { kvkNummer: null, datum: null, handelsnaam: null };

    const res = await fetch(`${KVK_SEARCH}?${params}`, { headers });
    if (!res.ok) return { kvkNummer: null, datum: null, handelsnaam: null };
    const json: any = await res.json().catch(() => null);
    const items: any[] = json?.resultaten ?? [];
    if (items.length !== 1) return { kvkNummer: null, datum: null, handelsnaam: null };
    kvkNummer = items[0]?.kvkNummer ?? null;
    handelsnaam = items[0]?.naam ?? null;
  }
  if (!kvkNummer) return { kvkNummer: null, datum: null, handelsnaam: null };

  const res = await fetch(`${KVK_PROFILE}/${kvkNummer}`, { headers });
  if (!res.ok) return { kvkNummer, datum: null, handelsnaam };
  const prof: any = await res.json().catch(() => null);
  const datum = toIsoDate(prof?.formeleRegistratiedatum ?? prof?.materieleRegistratie?.datumAanvang);
  return { kvkNummer, datum, handelsnaam: handelsnaam ?? prof?.naam ?? null };
}

/** Vestigingsnummer + startdatum van DEZE vestiging. */
async function kvkVestigingLookup(apiKey: string, shop: any) {
  const headers = { apikey: apiKey, Accept: "application/json" };
  const postcode = normPc(shop.postcode);
  const huisnummer = shopHouseNumber(shop);
  if (!postcode || !huisnummer) return { vestigingsnummer: null, datum: null };

  const params = new URLSearchParams({ postcode, huisnummer, type: "hoofdvestiging,nevenvestiging" });
  if (shop.kvk_nummer) params.set("kvkNummer", String(shop.kvk_nummer));

  const res = await fetch(`${KVK_SEARCH}?${params}`, { headers });
  if (!res.ok) return { vestigingsnummer: null, datum: null };
  const json: any = await res.json().catch(() => null);
  const items: any[] = (json?.resultaten ?? []).filter((r: any) => r?.vestigingsnummer);
  const uniek = Array.from(new Set(items.map((r: any) => String(r.vestigingsnummer))));
  if (uniek.length !== 1) return { vestigingsnummer: null, datum: null };

  const vestigingsnummer = uniek[0]!;
  const profRes = await fetch(`${KVK_VESTIGING}/${vestigingsnummer}`, { headers });
  if (!profRes.ok) return { vestigingsnummer, datum: null };
  const prof: any = await profRes.json().catch(() => null);
  return {
    vestigingsnummer,
    datum: toIsoDate(prof?.formeleRegistratiedatum ?? prof?.materieleRegistratie?.datumAanvang),
  };
}

const SOCIAL_HOSTS: Array<[string, RegExp]> = [
  ["instagram", /instagram\.com\/[^"'\s?#<>]+/i],
  ["facebook", /facebook\.com\/[^"'\s?#<>]+/i],
  ["linkedin", /linkedin\.com\/[^"'\s?#<>]+/i],
  ["x", /(?:twitter|x)\.com\/[^"'\s?#<>]+/i],
];

const GENERIC_SOCIAL = /\/(sharer|share|intent|login|signup|plugins|tr|policies|help)/i;

function parseSite(html: string, baseUrl: string) {
  const abs = (u: string | null) => {
    if (!u) return null;
    try {
      return new URL(u, baseUrl).toString();
    } catch {
      return null;
    }
  };
  const pick = (re: RegExp) => html.match(re)?.[1] ?? null;

  const logo =
    abs(pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)) ??
    abs(pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)) ??
    abs(pick(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i)) ??
    abs(pick(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i)) ??
    abs("/favicon.ico");

  const socials: Record<string, string> = {};
  for (const [key, re] of SOCIAL_HOSTS) {
    const m = html.match(re);
    if (!m) continue;
    const url = `https://${m[0].replace(/^https?:\/\//, "")}`;
    if (GENERIC_SOCIAL.test(url)) continue;
    socials[key] = url;
  }
  return { logo, socials };
}

async function fetchSiteInfo(website: string) {
  const url = website.startsWith("http") ? website : `https://${website}`;
  const res = await withTimeout(
    (signal) =>
      fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, signal, redirect: "follow" }),
    9000,
  );
  if (!res.ok) return null;
  const html = (await res.text()).slice(0, 400_000);
  return parseSite(html, res.url || url);
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
  if (buf.byteLength < 200 || buf.byteLength > 3_000_000) return null;

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
            for (const shop of ordered.filter((s) => !s.kvk_checked_at).slice(0, kvkLimit)) {
              try {
                const { kvkNummer, datum, handelsnaam } = await kvkLookup(kvkKey, shop);
                const patch: Record<string, unknown> = {
                  kvk_nummer: kvkNummer ?? shop.kvk_nummer ?? null,
                  kvk_oprichtingsdatum: datum ?? shop.kvk_oprichtingsdatum ?? null,
                  kvk_checked_at: new Date().toISOString(),
                };
                if (!shop.exploitant && handelsnaam) patch["exploitant"] = handelsnaam;
                await db.from("coffeeshop_register").update(patch as any).eq("id", shop.id);
                Object.assign(shop, patch);
                kvkLookups++;
              } catch (e) {
                console.warn("KvK lookup fout", shop.id, String(e));
              }
            }

            for (const shop of ordered.filter((s) => !s.kvk_vestiging_checked_at).slice(0, kvkLimit)) {
              try {
                const { vestigingsnummer, datum } = await kvkVestigingLookup(kvkKey, shop);
                const patch: Record<string, unknown> = {
                  kvk_vestigingsnummer: vestigingsnummer ?? shop.kvk_vestigingsnummer ?? null,
                  kvk_vestiging_datum: datum ?? shop.kvk_vestiging_datum ?? null,
                  kvk_vestiging_checked_at: new Date().toISOString(),
                };
                if (!shop.oprichtingsdatum && datum) {
                  patch["oprichtingsdatum"] = datum;
                  patch["oprichtingsdatum_bron"] = "kvk-vestiging";
                }
                await db.from("coffeeshop_register").update(patch as any).eq("id", shop.id);
                Object.assign(shop, patch);
                vestigingLookups++;
              } catch (e) {
                console.warn("KvK vestiging fout", shop.id, String(e));
              }
            }
          }

          const webTodo = ordered
            .filter((s) => !s.web_checked_at && (s.website || websiteByShop.has(s.id)))
            .slice(0, webLimit);

          for (const shop of webTodo) {
            const website = String(shop.website ?? websiteByShop.get(shop.id) ?? "").trim();
            const patch: Record<string, unknown> = {
              web_checked_at: new Date().toISOString(),
              verrijkt_op: new Date().toISOString(),
            };
            if (!shop.website && website) patch["website"] = website;
            try {
              sitesChecked++;
              const info = website ? await fetchSiteInfo(website) : null;
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
                    patch["logo_bron"] = "website";
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
          });
        } catch (err: any) {
          console.error("register-enrich mislukt:", err?.message ?? err);
          return Response.json({ error: String(err?.message ?? err) }, { status: 500 });
        }
      },
    },
  },
});
