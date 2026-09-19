/**
 * Eén definitie van een "meetellende coffeeshop" in het landelijke register.
 *
 * Coffeeshopbeleid is de centrale classificatie: levert de bron het veld
 * telt_mee (schema 2.0), dan is dat leidend voor alle landelijke en openbare
 * tellingen. Alleen wanneer telt_mee ontbreekt (oude v1-gegevens, nog geen
 * sync) geldt de bestaande legacyregel, zodat er niets plotseling verdwijnt.
 *
 * Spiegelt exact public.register_telt_mee() in de database.
 */
export type RegisterStatusLike = {
  status?: string | null;
  vervallen?: boolean | null;
  telt_mee?: boolean | null;
  uitsluitreden?: string | null;
  raw?: Record<string, unknown> | null;
};

/** Legacyregel: alles wat niet gesloten of ruis is telt mee. */
function legacyCounts(shop: RegisterStatusLike): boolean {
  const status = String(shop.status ?? "").toLowerCase().trim();
  const isNoise = shop.raw?.is_ruis === true;
  const closedAt = String(shop.raw?.gesloten_op ?? "").trim();
  return !isNoise && status !== "gesloten" && !closedAt;
}

export function isActiveShop(shop: RegisterStatusLike): boolean {
  if (shop.vervallen) return false;
  if (shop.telt_mee === true || shop.telt_mee === false) return shop.telt_mee;
  return legacyCounts(shop);
}

/** Reden waarom een registerdossier buiten de tellingen valt (null = telt gewoon mee). */
export function exclusionReason(shop: RegisterStatusLike): string | null {
  if (isActiveShop(shop)) return null;
  if (shop.vervallen) return "Vervallen dossier";
  const bronReden = String(shop.uitsluitreden ?? "").trim();
  if (bronReden) return bronReden;
  if (shop.raw?.is_ruis === true) {
    const reden = String(shop.raw?.ruis_reden ?? "").trim();
    return reden ? `Ruis — ${reden}` : "Ruis (geen echte coffeeshop)";
  }
  const closedAt = String(shop.raw?.gesloten_op ?? "").trim();
  if (closedAt) return `Gesloten op ${closedAt}`;
  if (shop.telt_mee === false) return "Telt niet mee volgens het landelijke register";
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
