/** Pure helpers for link previews (testable, no network). */
export interface LinkPreview { url: string; title: string | null; description: string | null; image: string | null; site: string | null }

const PRIVATE_V4 = /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.)/;

/** Only public http(s) hosts on default ports; blocks localhost, private IPs and internal names. */
export function isSafePublicUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password || (u.port && u.port !== "443" && u.port !== "80")) return null;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h.includes(".") || h === "localhost" || /\.(local|internal|localhost|lan|home)$/.test(h)) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) && PRIVATE_V4.test(h)) return null;
  if (h.includes(":")) return null; // no IPv6 literals
  return u;
}

function decode(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ").trim();
}

function meta(html: string, key: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    if (name !== key) continue;
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (content) return decode(content);
  }
  return null;
}

export function parsePreview(html: string, pageUrl: string): LinkPreview {
  const title = meta(html, "og:title") ?? meta(html, "twitter:title")
    ?? (/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ? decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)![1]) : null);
  const description = meta(html, "og:description") ?? meta(html, "description") ?? meta(html, "twitter:description");
  let image = meta(html, "og:image") ?? meta(html, "twitter:image");
  if (image) {
    try { image = new URL(image, pageUrl).toString(); } catch { image = null; }
    if (image && !image.startsWith("https://")) image = null;
  }
  const clip = (s: string | null, n: number) => (s ? s.slice(0, n) : null);
  return { url: pageUrl, title: clip(title, 200), description: clip(description, 300), image,
    site: clip(meta(html, "og:site_name") ?? new URL(pageUrl).hostname.replace(/^www\./, ""), 80) };
}
