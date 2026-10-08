// Pure, testbare kern van de declaratie -> Informer koppeling.
// Bevat geen Deno-, netwerk- of databasecode: die worden als poorten geïnjecteerd.

export interface DeclarationStore {
  load(id: string): Promise<any | null>;
  /** Atomische claim (informer_status -> sending). Geeft true als deze aanroep de claim kreeg. */
  claim(id: string, retry: boolean): Promise<boolean>;
  markSent(id: string, documentId: string): Promise<void>;
  /** Alleen toepassen zolang de status nog 'sending' is. */
  markError(id: string, message: string): Promise<void>;
  markInvalid(id: string, message: string): Promise<void>;
  recordTodo(id: string, message: string): Promise<void>;
  resolveTodo(id: string): Promise<void>;
}

export interface InformerPort {
  findByReference(reference: string): Promise<string | null>;
  /** Maakt één te verwerken inkoopfactuur (nooit betaald). Geeft het document-id terug. */
  createPurchase(declaration: any, reference: string): Promise<string>;
}

export type DeclarationSyncResult = {
  success: boolean;
  error_message?: string;
  details: Record<string, unknown>;
};

export function declarationReference(declaration: { id: string }): string {
  return `DECL-${String(declaration.id).toUpperCase()}`;
}

export function declarationReceiptPaths(declaration: any): string[] {
  const paths = [...(Array.isArray(declaration?.receipt_paths) ? declaration.receipt_paths : []), declaration?.receipt_path]
    .filter((p: unknown): p is string => typeof p === "string" && p.length > 0);
  return [...new Set(paths)];
}

/** Verwijdert IBAN's, bearer-tokens/JWT's en lange base64-blokken uit tekst. */
export function redactSensitive(text: string): string {
  return String(text ?? "")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [TOKEN]")
    .replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+/g, "[TOKEN]")
    .replace(/\b(sb_(?:secret|publishable)_[A-Za-z0-9_-]+)/g, "[TOKEN]")
    .replace(/[A-Za-z0-9+/]{80,}={0,2}/g, "[DATA]")
    .replace(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){10,30}\b/gi, "[IBAN]");
}

// ---------------------------------------------------------------------------
// Informer relatie (leverancier) — payload volgens de officiële OpenAPI-spec
// (https://api.informer.eu/docs/v1/api-docs.json, schema RelationInput).
// Gedocumenteerd: relation_type is een string "0" (zakelijk) of "1" (privé),
// telefoon heet phone_number, relation_number "0" laat Informer een nummer
// genereren. Een veld "subtype" of "phone" bestaat niet in het schema.
// ---------------------------------------------------------------------------

export const RELATION_INPUT_FIELDS = [
  "relation_number", "relation_type", "company_name", "firstname", "surname_prefix", "surname",
  "street", "house_number", "house_number_suffix", "zip", "city", "country", "phone_number",
  "fax_number", "web", "email", "coc", "vat", "iban", "bic", "email_invoice",
  "sales_invoice_template_id", "payment_condition_id",
] as const;

export type SupplierInput = {
  firstname: string;
  surname_prefix?: string;
  surname: string;
  street: string;
  houseNumber: string;
  suffix?: string;
  zip: string;
  city: string;
  email?: string | null;
  phone?: string | null;
  iban?: string | null;
};

export function buildSupplierRelationPayload(input: SupplierInput): Record<string, string> {
  const raw: Record<string, unknown> = {
    relation_number: "0",
    relation_type: "1",
    firstname: input.firstname,
    surname_prefix: input.surname_prefix,
    surname: input.surname,
    street: input.street,
    house_number: input.houseNumber,
    house_number_suffix: input.suffix,
    zip: String(input.zip ?? "").replace(/\s+/g, " ").trim().toUpperCase(),
    city: input.city,
    country: "NL",
    email: input.email,
    email_invoice: input.email,
    phone_number: input.phone,
    iban: input.iban ? String(input.iban).replace(/\s+/g, "").toUpperCase() : undefined,
  };
  const payload: Record<string, string> = {};
  for (const field of RELATION_INPUT_FIELDS) {
    const value = raw[field];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) payload[field] = text;
  }
  return payload;
}

function redactPersonal(text: string): string {
  return redactSensitive(text)
    .replace(/[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+/g, "[EMAIL]")
    .replace(/\b\d{4}\s?[A-Z]{2}\b/gi, "[POSTCODE]")
    .replace(/\+?\d[\d\s-]{7,}\d/g, "[NUMMER]");
}

/**
 * Zet een Informer-foutantwoord om naar een veilige, korte melding voor admin.
 * Toont veldnamen (alleen bekende schemavelden) en geredigeerde meldingen;
 * nooit ingevulde waarden zoals IBAN, adres, e-mail, tokens of base64.
 */
export function describeInformerError(status: number | null | undefined, body: unknown): string | null {
  const parts: string[] = [];
  const known = new Set<string>(RELATION_INPUT_FIELDS as readonly string[]);
  const fieldLabel = (key: string) => (known.has(key) ? key : "veld");
  const msg = (v: unknown) => redactPersonal(String(v ?? "")).replace(/\s+/g, " ").trim().slice(0, 120);

  const collect = (value: unknown, field?: string) => {
    if (value == null) return;
    if (typeof value === "string" || typeof value === "number") {
      const m = msg(value);
      if (m) parts.push(field ? `${fieldLabel(field)}: ${m}` : m);
      return;
    }
    if (Array.isArray(value)) { value.forEach((v) => collect(v, field)); return; }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      if (typeof obj.message === "string" && (obj.field || obj.property)) {
        collect(obj.message, String(obj.field ?? obj.property));
        return;
      }
      for (const [k, v] of Object.entries(obj)) {
        if (["code", "status", "success", "url"].includes(k)) continue;
        collect(v, k === "message" ? field : k);
      }
    }
  };

  const b = body as any;
  if (typeof body === "string") collect(body);
  else if (b && typeof b === "object") {
    const err = b.errors ?? b.error ?? b.validation_errors ?? (status && status >= 400 ? b.message : undefined);
    collect(err);
  }
  const unique = [...new Set(parts)].slice(0, 8);
  if (unique.length) return `${status ? `HTTP ${status}: ` : ""}${unique.join("; ")}`.slice(0, 500);
  return status && status >= 400 ? `HTTP ${status}` : null;
}

/** Bewaart alleen metadata van API-calls; geen request/response bodies of headers. */
export function redactApiCalls<T extends Record<string, any>>(calls: T[]): Record<string, unknown>[] {
  return calls.map((c) => ({
    ts: c.ts, method: c.method, url: c.url, status: c.status, ok: c.ok,
    duration_ms: c.duration_ms, request_id: c.request_id,
    error: c.error ? redactSensitive(c.error) : undefined, auth_mode: c.auth_mode,
  }));
}

/** Vastgezette, in Informer gecontroleerde grootboekrekeningen per declaratiesoort. */
export const DECLARATION_LEDGERS: Readonly<Record<string, { code: string; ledgerId: number; description: string }>> = {
  reiskosten: { code: "4495", ledgerId: 15391231, description: "Kilometervergoeding" },
  // Bestaand type "overig" = overige reiskosten (OV, parkeren e.d.).
  overig: { code: "5010", ledgerId: 15391263, description: "Reiskosten" },
};

export function declarationLedgerFor(type: unknown): { code: string; ledgerId: number; description: string } | null {
  const key = String(type ?? "");
  return Object.prototype.hasOwnProperty.call(DECLARATION_LEDGERS, key) ? DECLARATION_LEDGERS[key] : null;
}

/** Haalt grootboekopties uit het purchase/options-antwoord (array, of object op id). */
export function extractLedgerOptions(body: unknown): any[] {
  const visit = (value: unknown, depth: number): any[] | null => {
    if (!value || typeof value !== "object" || depth > 4) return null;
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (!/ledger/i.test(key) || !nested || typeof nested !== "object") continue;
      if (Array.isArray(nested)) return nested;
      return Object.entries(nested as Record<string, any>).map(([id, item]) =>
        item && typeof item === "object" ? { id, ...item } : { id, description: String(item) });
    }
    for (const nested of Object.values(value as Record<string, unknown>)) {
      const found = visit(nested, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return visit(body, 0) ?? [];
}

/**
 * Kiest exact de afgesproken rekening en controleert die tegen de actuele opties.
 * Geen naamzoeker en geen eerste-optie-fallback: bij twijfel wordt afgebroken.
 */
export function selectDeclarationLedger(declarationType: unknown, ledgerOptions: any[]): number {
  const expected = declarationLedgerFor(declarationType);
  if (!expected) throw new Error(`Geen grootboekrekening ingesteld voor declaratiesoort "${String(declarationType)}"`);
  const match = ledgerOptions.find((item) => Number(item?.id ?? item?.ledger_id) === expected.ledgerId);
  if (!match) throw new Error(`Grootboekrekening ${expected.code} (${expected.ledgerId}) niet gevonden in Informer`);
  const code = match.number ?? match.code ?? match.ledger_number ?? match.account ?? match.ledger_account;
  if (code != null && String(code).trim() !== expected.code) {
    throw new Error(`Grootboekrekening ${expected.ledgerId} heeft in Informer code ${code}, verwacht ${expected.code}`);
  }
  const label = String(match.description ?? match.name ?? match.label ?? "");
  if (code == null && !label.includes(expected.code) && !label.toLowerCase().includes(expected.description.toLowerCase())) {
    throw new Error(`Grootboekrekening ${expected.ledgerId} komt niet overeen met ${expected.code} ${expected.description}`);
  }
  return expected.ledgerId;
}

export function validateDeclarationForInformer(declaration: any): string | null {
  if (declaration.status === "concept") return "Declaratie is nog een concept";
  if (declaration.status === "rejected") return "Afgewezen declaraties worden niet naar Informer gestuurd";
  if (!declarationLedgerFor(declaration.declaration_type)) return "Onbekende declaratiesoort; niet naar Informer gestuurd";
  if (!declaration.board_member_id) return "Bestuurslid ontbreekt";
  if (!(Number(declaration.amount) > 0)) return "Bedrag ontbreekt";
  if (!declaration.bank_account || !declaration.account_holder) return "Rekeningnummer of rekeninghouder ontbreekt";
  if (!declaration.appointment) return "Omschrijving ontbreekt";
  if (declaration.declaration_type !== "reiskosten" && declarationReceiptPaths(declaration).length === 0) {
    return "Bon ontbreekt; voeg eerst een bon toe";
  }
  return null;
}

export function declarationLineDescription(declaration: any, eventTitle: string | null): string {
  const kind = declaration.declaration_type === "reiskosten" ? "Kilometervergoeding"
    : declaration.declaration_type === "overig" ? "Overige reiskosten" : "Declaratie";
  const parts = [
    `${kind}: ${declaration.appointment || declaration.board_member_name}`,
    `Indiener: ${declaration.board_member_name}`,
    declaration.expense_date ? `Datum: ${declaration.expense_date}` : null,
    declaration.trajectory ? `Traject: ${declaration.trajectory}${declaration.km_return ? ` (${declaration.km_return} km)` : ""}` : null,
    eventTitle ? `Evenement: ${eventTitle}` : null,
    declaration.budget_reference ? `Dossier/begroting: ${declaration.budget_reference}` : null,
    `Uitbetalen aan: ${declaration.account_holder} ${String(declaration.bank_account).replace(/\s/g, "").toUpperCase()}`,
    `Ref: ${declarationReference(declaration)}`,
  ].filter(Boolean);
  return parts.join(" | ").slice(0, 1000);
}

export type CallerAuth = { userId: string | null; isAdminOrTreasurer: boolean; isServiceCall: boolean };

/** Wie mag een verzending starten? Indiener alleen de eerste keer; retry alleen admin/penningmeester. */
export function authorizeDeclarationCall(
  caller: CallerAuth,
  declaration: { submitted_by: string | null; informer_status: string; status: string } | null,
  retry: boolean,
): { allowed: boolean; status: number; retry: boolean } {
  if (caller.isServiceCall || caller.isAdminOrTreasurer) return { allowed: true, status: 200, retry };
  if (!caller.userId) return { allowed: false, status: 401, retry: false };
  if (!declaration || declaration.submitted_by !== caller.userId || retry
    || declaration.informer_status !== "not_sent" || declaration.status !== "pending") {
    return { allowed: false, status: 403, retry: false };
  }
  return { allowed: true, status: 200, retry: false };
}

export async function runDeclarationSync(
  declarationId: string,
  opts: { retry: boolean },
  store: DeclarationStore,
  informer: InformerPort,
): Promise<DeclarationSyncResult> {
  let claimed = false;
  try {
    const declaration = await store.load(declarationId);
    if (!declaration) throw new Error("Declaratie niet gevonden");
    if (["sent", "synced"].includes(declaration.informer_status) && declaration.informer_external_id) {
      return { success: true, details: { declaration_id: declarationId, already_synced: true } };
    }
    const invalid = validateDeclarationForInformer(declaration);
    if (invalid) {
      if (declaration.status !== "concept") await store.markInvalid(declarationId, invalid);
      return { success: false, error_message: invalid, details: { declaration_id: declarationId } };
    }
    if (!(await store.claim(declarationId, opts.retry))) {
      return { success: false, error_message: "Declaratie wordt al verwerkt of is al verzonden", details: { declaration_id: declarationId, skipped: true } };
    }
    claimed = true;

    const reference = declarationReference(declaration);
    const existing = await informer.findByReference(reference);
    if (existing) {
      await store.markSent(declarationId, existing);
      await store.resolveTodo(declarationId);
      return { success: true, details: { declaration_id: declarationId, reference, reused_existing: true } };
    }
    const documentId = await informer.createPurchase(declaration, reference);
    await store.markSent(declarationId, documentId);
    await store.resolveTodo(declarationId);
    return { success: true, details: { declaration_id: declarationId, reference } };
  } catch (error) {
    const message = redactSensitive((error as Error)?.message ?? String(error)).slice(0, 500);
    if (claimed) await store.markError(declarationId, message);
    await store.recordTodo(declarationId, message);
    return { success: false, error_message: message, details: { declaration_id: declarationId } };
  }
}
