import { createClient } from "npm:@supabase/supabase-js@2";

const PORTAL = "https://leden.coffeeshopbond.nl";
const OG_IMAGE = `${PORTAL}/og-image.png`;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmtDate = (d: string) => {
  try {
    return new Date(`${d}T12:00:00Z`).toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Amsterdam",
    });
  } catch {
    return d;
  }
};

const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : null);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Pad: /agenda-share/<code> of ?c=<code>
  const parts = url.pathname.split("/").filter(Boolean);
  const raw = url.searchParams.get("c") ?? parts[parts.length - 1] ?? "";
  const code = raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 12);

  const redirectTo = (path: string) =>
    new Response(null, { status: 302, headers: { Location: `${PORTAL}${path}` } });

  if (!code || code.toLowerCase() === "agenda-share") return redirectTo("/agenda");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase.rpc("get_agenda_share", { _code: code });
  const ev = Array.isArray(data) ? data[0] : null;
  if (error || !ev) return redirectTo("/agenda");

  const target = `${PORTAL}/a/${code.toUpperCase()}`;
  const image = ev.image_path
    ? `${PORTAL}/api/public/agenda-image/${code.toUpperCase()}`
    : OG_IMAGE;
  const time = [fmtTime(ev.start_time), fmtTime(ev.end_time)].filter(Boolean).join(" - ");
  const description = [fmtDate(ev.event_date), time || null, ev.location || null]
    .filter(Boolean)
    .join(" · ");

  const html = `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(ev.title)} — BCD Ledenportaal</title>
<meta name="description" content="${esc(description)}" />
<meta name="robots" content="noindex, nofollow" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="BCD Ledenportaal" />
<meta property="og:title" content="${esc(ev.title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(target)}" />
<meta property="og:image" content="${esc(image)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(ev.title)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<link rel="canonical" href="${esc(target)}" />
<meta http-equiv="refresh" content="0; url=${esc(target)}" />
<script>window.location.replace(${JSON.stringify(target)});</script>
</head>
<body>
<p><a href="${esc(target)}">${esc(ev.title)} — ${esc(description)}</a></p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
});
