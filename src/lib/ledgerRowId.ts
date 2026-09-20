/**
 * Rij-id's in de begrotingsweergave hebben een bronprefix. Canonieke
 * Informer-regels krijgen "ledger:<doc_type>:<informer_id>"; het informer_id
 * mag zelf dubbele punten bevatten en mag bij het parsen nooit verloren gaan.
 */
export type LedgerRowRef = { doc_type: string; informer_id: string };

export function parseLedgerRowId(rawId: string): LedgerRowRef | null {
  if (!rawId || !rawId.startsWith("ledger:")) return null;
  const rest = rawId.slice("ledger:".length);
  const idx = rest.indexOf(":");
  if (idx <= 0) return null;
  const doc_type = rest.slice(0, idx);
  const informer_id = rest.slice(idx + 1);
  if (!doc_type || !informer_id) return null;
  return { doc_type, informer_id };
}

/** Canonieke sleutel voor documenten, dossiers en splits (zonder UI-prefix). */
export function ledgerEntryKey(ref: LedgerRowRef): string {
  return `${ref.doc_type}:${ref.informer_id}`;
}

export type RowTarget =
  | { kind: "ledger"; ref: LedgerRowRef }
  | { kind: "ponto"; id: string }
  | { kind: "bank"; id: string }
  | { kind: "contrib" }
  | { kind: "expense"; id: string };

export function classifyRowId(rawId: string): RowTarget {
  const ledger = parseLedgerRowId(rawId);
  if (ledger) return { kind: "ledger", ref: ledger };
  if (rawId.startsWith("ponto:")) return { kind: "ponto", id: rawId.slice("ponto:".length) };
  if (rawId.startsWith("bank:")) return { kind: "bank", id: rawId.slice("bank:".length) };
  if (rawId.startsWith("contrib:")) return { kind: "contrib" };
  return { kind: "expense", id: rawId };
}

/** Sleutel voor dossiersplits/documenten per rijsoort; null = niet ondersteund. */
export function entryKeyFromRowId(rawId: string): string | null {
  const t = classifyRowId(rawId);
  switch (t.kind) {
    case "ledger":
      return ledgerEntryKey(t.ref);
    case "ponto":
      return `ponto:${t.id}`;
    case "bank":
      return `bank:${t.id}`;
    case "contrib":
      return null;
    case "expense":
      return `expense:${t.id}`;
  }
}

/**
 * Een upsert die nul rijen teruggeeft betekent dat er niets is opgeslagen
 * (bijvoorbeeld doordat een RLS-policy de schrijfactie blokkeert). Dat mag
 * nooit als succes worden gemeld.
 */
export function assertOverrideSaved(
  rows: unknown[] | null | undefined,
  ref: LedgerRowRef,
): void {
  if (!rows || rows.length === 0) {
    throw new Error(
      `Opslaan mislukt: er is geen regel bijgewerkt voor ${ledgerEntryKey(ref)}.`,
    );
  }
}

/**
 * Historisch zijn dossiersplits/documenten van canonieke Informer-regels ook
 * opgeslagen onder "ledger:<doc_type>:<informer_id>" en
 * "expense:ledger:<doc_type>:<informer_id>". We schrijven voortaan canoniek,
 * maar lezen alle varianten.
 */
export function ledgerEntryKeyAliases(canonicalKey: string): string[] {
  if (!canonicalKey) return [];
  return [canonicalKey, `ledger:${canonicalKey}`, `expense:ledger:${canonicalKey}`];
}

/**
 * Parseert een dossiersleutel van een canonieke Informer-regel. Ondersteunt de
 * canonieke vorm en de oude geprefixte varianten; informer_id mag dubbele
 * punten bevatten en gaat nooit verloren.
 */
export function parseLedgerEntryKey(key: string): LedgerRowRef | null {
  if (!key) return null;
  let rest = key;
  if (rest.startsWith("expense:")) rest = rest.slice("expense:".length);
  if (rest.startsWith("ledger:")) rest = rest.slice("ledger:".length);
  const idx = rest.indexOf(":");
  if (idx <= 0) return null;
  const doc_type = rest.slice(0, idx);
  const informer_id = rest.slice(idx + 1);
  if (!doc_type || !informer_id) return null;
  return { doc_type, informer_id };
}
