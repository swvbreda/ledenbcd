/**
 * Eén definitie van een "actieve coffeeshop" in het landelijke register.
 *
 * Alleen vergunningen die daadwerkelijk tot een werkende coffeeshop leiden
 * tellen mee in statistieken: actief, verlengd of verleend. Aanvragen,
 * weigeringen en intrekkingen blijven zichtbaar in het register maar tellen
 * niet mee in aantallen shops, gemeenten of vertegenwoordigingspercentages.
 */
export const VERGUND_STATUSSEN = ["actief", "verlengd", "verleend"] as const;

export type RegisterStatusLike = {
  status?: string | null;
  vervallen?: boolean | null;
};

export function isVergundeStatus(status: string | null | undefined): boolean {
  return VERGUND_STATUSSEN.includes(String(status ?? "").toLowerCase() as (typeof VERGUND_STATUSSEN)[number]);
}

export function isActiveShop(shop: RegisterStatusLike): boolean {
  return !shop.vervallen && isVergundeStatus(shop.status);
}
