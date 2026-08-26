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
