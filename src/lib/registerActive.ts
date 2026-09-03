/**
 * Eén definitie van een "actieve coffeeshop" in het landelijke register.
 *
 * Exact dezelfde definitie als het geverifieerde Coffeeshopbeleid-register:
 * alle niet-gesloten dossiers tellen mee, behalve expliciete ruis. Hierdoor
 * horen lopende aanvragen wel bij de actuele landelijke registertelling.
 */
export type RegisterStatusLike = {
  status?: string | null;
  vervallen?: boolean | null;
  raw?: Record<string, unknown> | null;
};

export function isActiveShop(shop: RegisterStatusLike): boolean {
  const status = String(shop.status ?? "").toLowerCase().trim();
  const isNoise = shop.raw?.is_ruis === true;
  const closedAt = String(shop.raw?.gesloten_op ?? "").trim();
  return !shop.vervallen && !isNoise && status !== "gesloten" && !closedAt;
}

/** Reden waarom een registerdossier buiten de tellingen valt (null = telt gewoon mee). */
export function exclusionReason(shop: RegisterStatusLike): string | null {
  if (isActiveShop(shop)) return null;
  if (shop.vervallen) return "Vervallen dossier";
  if (shop.raw?.is_ruis === true) {
    const reden = String(shop.raw?.ruis_reden ?? "").trim();
    return reden ? `Ruis — ${reden}` : "Ruis (geen echte coffeeshop)";
  }
  const closedAt = String(shop.raw?.gesloten_op ?? "").trim();
  if (closedAt) return `Gesloten op ${closedAt}`;
  return "Gesloten";
}

/**
 * Leesbaar label voor de vergunningsstatus uit het register.
 * Ruwe waarden zoals "actief" of "in_behandeling" zeggen weinig over de
 * vergunningssituatie; we vertalen ze naar vergund / aangevraagd / geweigerd.
 */
export function statusLabel(status?: string | null): string | null {
  const s = String(status ?? "").toLowerCase().trim();
  if (!s) return null;
  if (["actief", "verleend", "verlengd"].includes(s)) return "Vergund";
  if (["aangevraagd", "in_behandeling", "in behandeling"].includes(s)) return "Aangevraagd";
  if (["geweigerd", "ingetrokken", "verlopen", "gesloten"].includes(s)) return "Geweigerd / vervallen";
  const pretty = s.replace(/_/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}
