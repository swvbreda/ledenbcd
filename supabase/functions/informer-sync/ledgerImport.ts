// Pure regels voor het importeren van Informer-documenten in het ledenbestand.

/**
 * Een document dat niet in het (beperkte) lijstvenster staat, is alleen
 * aantoonbaar verwijderd als Informer het per-id expliciet niet vindt.
 * Netwerkfouten, 5xx, 401/403 of een gewoon antwoord = niet verwijderd.
 */
export function isProvenDeleted(status: number | string, body: unknown): boolean {
  if (status === 404) return true;
  const text = typeof body === "string" ? body : JSON.stringify(body ?? "");
  return /no records found|not found|niet gevonden/i.test(text) && Number(status) >= 400 && Number(status) < 500 && Number(status) !== 401 && Number(status) !== 403;
}

/**
 * Bonnetje: alleen verwerkte (via journaal volledig verwerkt) bonnetjes tellen
 * als kosten. Onverwerkte bonnetjes worden bewaard als 'unprocessed' en tellen
 * niet mee. DECL-bonnetjes volgen dezelfde regel niet: die zijn al als
 * goedgekeurde declaratie kosten en worden geïmporteerd als 'open' tot verwerkt.
 */
export function receiptStatus(amount: number, processed: number, isDecl: boolean): "paid" | "open" | "unprocessed" {
  const a = Math.abs(Number(amount) || 0);
  const p = Math.abs(Number(processed) || 0);
  if (a > 0 && p + 0.005 >= a) return "paid";
  return isDecl ? "open" : "unprocessed";
}
