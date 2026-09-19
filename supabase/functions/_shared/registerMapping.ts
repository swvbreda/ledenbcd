/**
 * Gedeelde, pure logica voor de coffeeshopregister-import.
 *
 * Coffeeshopbeleid levert vanaf schema_version "2.0" een centrale
 * classificatie mee (telt_mee + uitsluitreden). Die classificatie is
 * leidend voor alle landelijke/openbare tellingen en voor automatische
 * matching. Zolang de bron nog v1 levert (telt_mee ontbreekt) blijft de
 * bestaande legacylogica gelden, zodat er vóór de eerste v2-sync niets
 * verandert.
 *
 * Deze module bevat géén Deno- of netwerkcode, zodat hij direct testbaar is.
 */

export type SourceShop = Record<string, any>;

export type GemeenteInfo = { naam?: string | null; provincie?: string | null };

export type RegisterRow = {
  bron_id: string;
  naam: string;
  straat: string | null;
  huisnummer: string | null;
  huisnummer_toevoeging: string | null;
  postcode: string | null;
  plaats: string | null;
  gemeente: string | null;
  provincie: string | null;
  latitude: number | null;
  longitude: number | null;
  exploitant: string | null;
  vergunninghouder: string | null;
  vergunningnummer: string | null;
  status: string;
  vergunningverlening: string | null;
  einddatum: string | null;
  website: string | null;
  telefoon: string | null;
  logo_url: string | null;
  socials: Record<string, unknown> | null;
  oprichtingsdatum: string | null;
  oprichtingsdatum_bron: string | null;
  shopcode: string | null;
  bag_pand_id: string | null;
  bag_verblijfsobject_id: string | null;
  verrijkt_op: string | null;
  telt_mee: boolean | null;
  uitsluitreden: string | null;
  exploitatie_status_bron: string | null;
  controle_nodig_bron: boolean | null;
  is_baseline_shop_bron: boolean | null;
  bron_schema_version: string | null;
  raw: SourceShop;
  vervallen: boolean;
  synced_at: string;
};

const PLACE_SYNONYMS: Record<string, string> = {
  "'s-gravenhage": "Den Haag",
  "s-gravenhage": "Den Haag",
  "den haag": "Den Haag",
  "'s-hertogenbosch": "'s-Hertogenbosch",
  "s-hertogenbosch": "'s-Hertogenbosch",
  "den bosch": "'s-Hertogenbosch",
};

export function canonPlace(value: string | null | undefined): string | null {
  let v = (value ?? "").replace(/[‘’´`]/g, "'").replace(/\s+/g, " ").trim();
  if (!v) return null;
  v = v.replace(/\s*\([A-Za-z.\s]+\)\s*$/, "").trim();
  return PLACE_SYNONYMS[v.toLowerCase()] ?? v;
}

/** Bronversie uit de response; ontbreekt hij, dan behandelen we hem als v1. */
export function detectSchemaVersion(payload: any): string {
  const raw = payload?.schema_version ?? payload?.schemaVersion ?? "";
  const v = String(raw).trim();
  return v || "1.0";
}

export function isV2(schemaVersion: string): boolean {
  return Number.parseFloat(schemaVersion) >= 2;
}

function asBool(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function text(value: unknown): string | null {
  const v = typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
  return v === "" ? null : v;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Straat/huisnummer uit één samengesteld adresveld halen (alleen legacy). */
export function splitLegacyAdres(adres: string | null): { straat: string | null; huisnummer: string | null; toevoeging: string | null } {
  const v = (adres ?? "").trim();
  if (!v) return { straat: null, huisnummer: null, toevoeging: null };
  const m = v.match(/^(.*?)[\s,]+(\d+)\s*([A-Za-z0-9\-/]*)$/);
  if (!m) return { straat: v, huisnummer: null, toevoeging: null };
  return {
    straat: m[1].trim() || null,
    huisnummer: m[2] ?? null,
    toevoeging: (m[3] ?? "").trim() || null,
  };
}

export type CountableLike = {
  telt_mee?: boolean | null;
  vervallen?: boolean | null;
  status?: string | null;
  raw?: Record<string, unknown> | null;
};

/**
 * Eén predicate voor "telt mee in landelijke/openbare tellingen".
 * Typed telt_mee is leidend; alleen wanneer die NULL is geldt de legacyregel.
 * Spiegelt exact public.register_telt_mee() in de database.
 */
export function shopCounts(shop: CountableLike): boolean {
  if (shop.vervallen) return false;
  if (shop.telt_mee === true || shop.telt_mee === false) return shop.telt_mee;
  const status = String(shop.status ?? "").toLowerCase().trim();
  const isNoise = shop.raw?.["is_ruis"] === true;
  const closedAt = String(shop.raw?.["gesloten_op"] ?? "").trim();
  return !isNoise && status !== "gesloten" && !closedAt;
}

/** Eén registerdossier uit de bron omzetten naar een databaseregel. */
export function mapShopRow(
  s: SourceShop,
  opts: { gemeente?: GemeenteInfo | null; schemaVersion: string; now?: string },
): RegisterRow {
  const v2 = isV2(opts.schemaVersion);
  const gemeente = canonPlace(
    opts.gemeente?.naam ??
      (typeof s.gemeentenaam === "string" ? s.gemeentenaam : null) ??
      (typeof s.gemeente === "string" ? s.gemeente : s.gemeente?.naam ?? null),
  );

  // v2 levert genormaliseerde adresvelden; "adres"/"volledig_adres" is puur legacy-fallback.
  const legacy = splitLegacyAdres(text(s.volledig_adres ?? s.adres));
  const straat = text(s.straat) ?? legacy.straat;
  const huisnummer = text(s.huisnummer) ?? legacy.huisnummer;
  const toevoeging = text(s.huisnummer_toevoeging) ?? legacy.toevoeging;

  const teltMee = v2 ? asBool(s.telt_mee) : null;

  return {
    bron_id: s.id,
    naam: s.naam_coffeeshop ?? s.naam ?? "Onbekend",
    straat,
    huisnummer,
    huisnummer_toevoeging: toevoeging,
    postcode: text(s.postcode),
    plaats: canonPlace(s.plaats) ?? gemeente,
    gemeente,
    provincie: text(opts.gemeente?.provincie ?? s.provincie),
    latitude: num(s.latitude),
    longitude: num(s.longitude),
    exploitant: s.exploitant ?? null,
    vergunninghouder: s.vergunninghouder ?? null,
    vergunningnummer: s.vergunningnummer ?? null,
    status: s.status ?? "actief",
    vergunningverlening: s.vergunningverlening ?? null,
    einddatum: s.einddatum ?? null,
    website: s.website ?? null,
    telefoon: s.telefoon ?? null,
    logo_url: typeof s.logo_url === "string" && /^https?:\/\//i.test(s.logo_url) ? s.logo_url : null,
    socials: s.socials && typeof s.socials === "object" ? s.socials : null,
    oprichtingsdatum: s.oprichtingsdatum ?? null,
    oprichtingsdatum_bron: s.oprichtingsdatum_bron ?? null,
    shopcode: s.shopcode ?? s.shop_code ?? null,
    bag_pand_id: text(s.bag_pand_id),
    bag_verblijfsobject_id: text(s.bag_verblijfsobject_id),
    verrijkt_op: s.verrijkt_op ?? null,
    telt_mee: teltMee,
    uitsluitreden: v2 ? text(s.uitsluitreden ?? s.ruis_reden) : null,
    exploitatie_status_bron: v2 ? text(s.exploitatie_status) : null,
    controle_nodig_bron: v2 ? asBool(s.controle_nodig) : null,
    is_baseline_shop_bron: v2 ? asBool(s.is_baseline_shop) : null,
    bron_schema_version: opts.schemaVersion,
    raw: s,
    vervallen: false,
    synced_at: opts.now ?? new Date().toISOString(),
  };
}

export type DryRunReport = {
  schema_version: string;
  v2: boolean;
  totaal_dossiers: number;
  public_total: number | null;
  counts_bron: Record<string, unknown> | null;
  telt_mee_true: number;
  telt_mee_false: number;
  telt_mee_onbekend: number;
  zonder_straat: number;
  zonder_huisnummer: number;
  zonder_postcode: number;
  zonder_coordinaten: number;
  zonder_gemeente: number;
  bestaande_koppelingen: number;
  koppelingen_buiten_publieke_set: number;
  voorbeelden_buiten_publieke_set: string[];
};

/**
 * Validatie zonder te schrijven: wat levert de bron, wat ontbreekt er en
 * welke bestaande koppelingen vallen straks buiten de meetellende set?
 */
export function buildDryRunReport(
  payload: any,
  rows: RegisterRow[],
  gekoppeldeBronIds: string[],
): DryRunReport {
  const schemaVersion = detectSchemaVersion(payload);
  const publicList = payload?.public_coffeeshops;
  const counts = payload?.counts && typeof payload.counts === "object" ? payload.counts : null;
  const publicTotal = Array.isArray(publicList)
    ? publicList.length
    : num(counts?.public_total ?? counts?.publiek ?? null);

  const gekoppeld = new Set(gekoppeldeBronIds.map(String));
  const buiten = rows.filter((r) => gekoppeld.has(String(r.bron_id)) && !shopCounts(r));

  return {
    schema_version: schemaVersion,
    v2: isV2(schemaVersion),
    totaal_dossiers: rows.length,
    public_total: publicTotal,
    counts_bron: counts,
    telt_mee_true: rows.filter((r) => r.telt_mee === true).length,
    telt_mee_false: rows.filter((r) => r.telt_mee === false).length,
    telt_mee_onbekend: rows.filter((r) => r.telt_mee === null).length,
    zonder_straat: rows.filter((r) => !r.straat).length,
    zonder_huisnummer: rows.filter((r) => !r.huisnummer).length,
    zonder_postcode: rows.filter((r) => !r.postcode).length,
    zonder_coordinaten: rows.filter((r) => r.latitude === null || r.longitude === null).length,
    zonder_gemeente: rows.filter((r) => !r.gemeente).length,
    bestaande_koppelingen: gekoppeld.size,
    koppelingen_buiten_publieke_set: buiten.length,
    voorbeelden_buiten_publieke_set: buiten.slice(0, 25).map((r) => `${r.naam} (${r.plaats ?? "?"})`),
  };
}
