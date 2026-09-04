const PORTAL = "https://leden.coffeeshopbond.nl";

/**
 * Oude deel-links blijven werken: alles wordt permanent doorgestuurd naar de
 * nette uitnodigingspagina op het ledenportaal (met echte preview).
 */
Deno.serve((req) => {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const raw = url.searchParams.get("c") ?? parts[parts.length - 1] ?? "";
  const code = raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 12);

  const target =
    !code || code.toLowerCase() === "agenda-share"
      ? `${PORTAL}/agenda`
      : `${PORTAL}/a/${code.toUpperCase()}`;

  return new Response(null, {
    status: 301,
    headers: {
      Location: target,
      "Cache-Control": "public, max-age=300",
    },
  });
});
