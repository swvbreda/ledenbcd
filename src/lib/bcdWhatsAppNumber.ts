/** The only phone_number_id members may send link codes to (fixed BCD recipient). */
export const BCD_SUPPORT_PHONE_NUMBER_ID = "1312061225331302";

/**
 * Business number belonging to BCD_SUPPORT_PHONE_NUMBER_ID, proven from a verified
 * inbound delivery (metadata.display_phone_number). Never a publisher's personal number.
 */
export const BCD_SUPPORT_NUMBER = { display: "+31 6 86875231", digits: "31686875231" } as const;

/** Validate a connector phone_number read-back; must match the fixed id AND proven number. Never guesses. */
export function parseBcdPhoneNumber(body: unknown): { display: string; digits: string } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { id?: unknown; display_phone_number?: unknown };
  if (b.id !== BCD_SUPPORT_PHONE_NUMBER_ID || typeof b.display_phone_number !== "string") return null;
  const digits = b.display_phone_number.replace(/\D/g, "");
  if (digits !== BCD_SUPPORT_NUMBER.digits) return null;
  return { display: BCD_SUPPORT_NUMBER.display, digits };
}

export function waDeepLink(digits: string, code: string) {
  return `https://wa.me/${digits}?text=${encodeURIComponent(code)}`;
}
