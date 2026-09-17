/**
 * Server-only hulpmiddelen om het logo van een coffeeshopwebsite te vinden en
 * op te slaan in de bucket `shop-logos`.
 *
 * Belangrijk: vierkante website-icoontjes (apple-touch-icon / favicon) zijn
 * vaak een uitsnede van het echte logo. Die worden daarom alleen gebruikt als
 * er niets beters te vinden is.
 */

const BUCKET = "shop-logos";
const UA =
  "Mozilla/5.0 (compatible; BCD-Ledenbestand/1.0; +https://leden.coffeeshopbond.nl)";

export async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

export type LogoKandidaten = {
  /** Logo-adressen in volgorde van voorkeur. */
  kandidaten: string[];
  /** Waarschijnlijk een sfeerfoto in plaats van een logo. */
  fotoUrl: string | null;
  socials: Record<string, string>;
};

const SOCIAL_HOSTS: Array<[string, RegExp]> = [
  ["instagram", /instagram\.com\/[^"'\s?#<>]+/i],
  ["facebook", /facebook\.com\/[^"'\s?#<>]+/i],
  ["linkedin", /linkedin\.com\/[^"'\s?#<>]+/i],
  ["x", /(?:twitter|x)\.com\/[^"'\s?#<>]+/i],
];

const GENERIC_SOCIAL = /\/(sharer|share|intent|login|signup|plugins|tr|policies|help)/i;

/** Zoekt alle mogelijke logo-adressen op een pagina, beste eerst. */
export function parseLogoKandidaten(html: string, baseUrl: string): LogoKandidaten {
  const abs = (u: string | null) => {
    if (!u) return null;
    try {
      return new URL(u, baseUrl).toString();
    } catch {
      return null;
    }
  };
  const pick = (re: RegExp) => html.match(re)?.[1] ?? null;

  // Echte <img>-logo's: alle treffers, niet alleen de eerste.
  const imgLogos: string[] = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/logo/i.test(tag)) continue;
    if (/sprite|placeholder|loading|lazy-?placeholder/i.test(tag)) continue;
    const src =
      tag.match(/\bsrc=["']([^"']+)["']/i)?.[1] ??
      tag.match(/\bdata-src=["']([^"']+)["']/i)?.[1] ??
      tag.match(/\bsrcset=["']([^"'\s,]+)/i)?.[1] ??
      null;
    if (!src || src.startsWith("data:")) continue;
    const url = abs(src);
    if (url && !imgLogos.includes(url)) imgLogos.push(url);
    if (imgLogos.length >= 4) break;
  }

  const ogLogo = abs(pick(/<meta[^>]+property=["']og:logo["'][^>]+content=["']([^"']+)["']/i));
  const appleIcon = abs(
    pick(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]+href=["']([^"']+)["']/i),
  );
  const icon = abs(pick(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i));
  const ogImage =
    abs(pick(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)) ??
    abs(pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i));

  // Voorkeur: echt logobestand, daarna og:logo, dan pas vierkante icoontjes.
  const kandidaten = [...imgLogos, ogLogo, appleIcon, icon, abs("/favicon.ico")].filter(
    (v): v is string => !!v,
  );

  const socials: Record<string, string> = {};
  for (const [key, re] of SOCIAL_HOSTS) {
    const m = html.match(re);
    if (!m) continue;
    const url = `https://${m[0].replace(/^https?:\/\//, "")}`;
    if (GENERIC_SOCIAL.test(url)) continue;
    socials[key] = url;
  }

  return { kandidaten: [...new Set(kandidaten)], fotoUrl: ogImage, socials };
}

export async function fetchHtml(website: string) {
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

/** Leest breedte en hoogte uit de eerste bytes van een afbeelding. */
export function imageSize(bytes: Uint8Array, type: string): { w: number; h: number } | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    // PNG
    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      return { w: dv.getUint32(16), h: dv.getUint32(20) };
    }
    // GIF
    if (bytes[0] === 0x47 && bytes[1] === 0x49) {
      return { w: dv.getUint16(6, true), h: dv.getUint16(8, true) };
    }
    // JPEG
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      let i = 2;
      while (i + 9 < bytes.byteLength) {
        if (bytes[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = bytes[i + 1] ?? 0;
        const len = dv.getUint16(i + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { w: dv.getUint16(i + 7), h: dv.getUint16(i + 5) };
        }
        i += 2 + len;
      }
      return null;
    }
    // WEBP (VP8X)
    if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[12] === 0x56 && bytes[15] === 0x58) {
      const w = 1 + ((bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)) & 0xffffff);
      const h = 1 + ((bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) & 0xffffff);
      return { w, h };
    }
  } catch {
    return null;
  }
  if (type.includes("svg")) return null;
  return null;
}

const extForType = (type: string) =>
  type.includes("png")
    ? "png"
    : type.includes("svg")
      ? "svg"
      : type.includes("webp")
        ? "webp"
        : type.includes("icon")
          ? "ico"
          : "jpg";

type Gedownload = { bytes: Uint8Array; type: string; url: string; verdacht: boolean };

async function downloadImage(url: string): Promise<Gedownload | null> {
  try {
    const res = await withTimeout(
      (signal) => fetch(url, { headers: { "User-Agent": UA }, signal, redirect: "follow" }),
      9000,
    );
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0] ?? "";
    if (!/^image\//i.test(type)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength < 500 || bytes.byteLength > 3_000_000) return null;
    const maat = imageSize(bytes, type);
    // Klein vierkant bestand: bijna altijd een website-icoontje of uitsnede.
    const verdacht = !!maat && maat.w === maat.h && maat.w <= 320;
    return { bytes, type, url, verdacht };
  } catch {
    return null;
  }
}

/**
 * Downloadt het beste logo uit de kandidatenlijst: een niet-vierkant logo gaat
 * altijd voor; vierkante icoontjes gelden alleen als laatste redmiddel.
 */
export async function bestLogoImage(kandidaten: string[]): Promise<Gedownload | null> {
  let reserve: Gedownload | null = null;
  for (const url of kandidaten.slice(0, 6)) {
    const img = await downloadImage(url);
    if (!img) continue;
    if (!img.verdacht) return img;
    if (!reserve) reserve = img;
  }
  return reserve;
}

/** Slaat het logo op in de bucket en geeft het pad terug. */
export async function saveLogoBytes(
  db: any,
  shopId: string,
  bytes: Uint8Array,
  type: string,
): Promise<string | null> {
  const path = `${shopId}.${extForType(type)}`;
  const { error } = await db.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: type, upsert: true });
  if (error) {
    console.warn("logo opslaan mislukt", shopId, error.message);
    return null;
  }
  return path;
}

/** Haalt het logo van een website op en slaat het op. */
export async function fetchAndStoreLogo(db: any, shopId: string, website: string) {
  const page = await fetchHtml(website);
  if (!page) return null;
  const info = parseLogoKandidaten(page.html, page.url);
  const img = await bestLogoImage(info.kandidaten);
  if (!img) return null;
  const path = await saveLogoBytes(db, shopId, img.bytes, img.type);
  if (!path) return null;
  return { path, socials: info.socials, bron: img.verdacht ? "icoon" : "logo" };
}
