/** The only phone_number_id members may send link codes to (fixed BCD recipient). */
export const BCD_SUPPORT_PHONE_NUMBER_ID = "1312061225331302";

/** Validate a connector phone_number read-back; returns digits-only number or null. Never guesses. */
export function parseBcdPhoneNumber(body: unknown): { display: string; digits: string } | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { id?: unknown; display_phone_number?: unknown };
  if (b.id !== BCD_SUPPORT_PHONE_NUMBER_ID || typeof b.display_phone_number !== "string") return null;
  const digits = b.display_phone_number.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return { display: b.display_phone_number.trim(), digits };
}

export function waDeepLink(digits: string, code: string) {
  return `https://wa.me/${digits}?text=${encodeURIComponent(code)}`;
}
