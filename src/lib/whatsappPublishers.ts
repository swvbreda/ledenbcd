/** International numbers only: never infer a country or trust an account phone. */
export function normalizePublisherPhone(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, "");
  const international = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  return /^\+[1-9]\d{7,14}$/.test(international) ? international : null;
}

export const ANNOUNCEMENT_DECISIONS: Record<string, string> = {
  published: "Gepubliceerd bij Aankondigingen",
  not_allowed: "Alleen inbox: afzender niet toegestaan",
  not_forwarded: "Alleen inbox: niet expliciet doorgestuurd",
  attachment: "Alleen inbox: bijlage niet verwerkt; niet gepubliceerd",
  invalid_text: "Alleen inbox: lege tekst of meer dan 5.000 tekens",
  wrong_recipient: "Alleen inbox: BCD-ontvanger niet bevestigd",
  inactive_admin: "Alleen inbox: toestemmende beheerder heeft geen beheerrechten meer",
  ignored: "Alleen inbox: geen inkomend tekstbericht",
};