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
  attachment: "Alleen inbox: bijlagetype niet ondersteund (alleen foto jpg/png of PDF); niet gepubliceerd",
  attachment_pending: "Bijlage wordt opgehaald; wordt pas gepubliceerd als het bestand compleet is opgeslagen",
  attachment_failed: "Alleen inbox: bijlage kon niet worden opgehaald (of groter dan 20 MB); niet gepubliceerd",
  attachment_no_caption: "Alleen inbox: foto zonder onderschrift; niet gepubliceerd",
  invalid_text: "Alleen inbox: lege tekst of meer dan 5.000 tekens",
  wrong_recipient: "Alleen inbox: BCD-ontvanger niet bevestigd",
  inactive_admin: "Alleen inbox: toestemmende beheerder heeft geen beheerrechten meer",
  ignored: "Alleen inbox: geen inkomend tekstbericht",
};