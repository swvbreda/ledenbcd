// Pure, testbare kern van de declaratie -> Informer koppeling.
// Bevat geen Deno-, netwerk- of databasecode: die worden als poorten geïnjecteerd.

export interface DeclarationStore {
  load(id: string): Promise<any | null>;
  /** Atomische claim (informer_status -> sending). Geeft true als deze aanroep de claim kreeg. */
  claim(id: string, retry: boolean): Promise<boolean>;
  markSent(id: string, documentId: string, docType: InformerDocType): Promise<void>;
  /** Alleen toepassen zolang de status nog 'sending' is. */
  markError(id: string, message: string): Promise<void>;
  markInvalid(id: string, message: string): Promise<void>;
  recordTodo(id: string, message: string): Promise<void>;
  resolveTodo(id: string): Promise<void>;
}

export type InformerDocType = "purchase_invoice" | "receipt";
/** Gevonden Informer-document. id-nummers zijn niet uniek over soorten heen: altijd met type. */
export type InformerDocRef = { id: string; type: InformerDocType; amount?: number | null; date?: string | null };

export interface InformerPort {
  /**
   * Zoekt exact het DECL-kenmerk in BEIDE namespaces (inkoopfacturen.number én bonnetjes.description).
   * Faalt dicht: lijstfout of meer dan één treffer => throw.
   */
  findByReference(reference: string): Promise<InformerDocRef | null>;
  /** Maakt één bonnetje (Uitgaven, payment_type bank; geen betaling/bankboeking). Geeft het id terug. */
  createReceipt(declaration: any, reference: string): Promise<string>;
}

const DECL_TOKEN = /\bDECL-[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\b/gi;
/** Alle DECL-kenmerken in een tekst (hoofdletters, uniek). */
export function declTokens(text: unknown): string[] {
  return [...new Set((String(text ?? "").match(DECL_TOKEN) ?? []).map((t) => t.toUpperCase()))];
}
/** Bonnetje-omschrijving: canoniek kenmerk vooraan + leesbaar label (soort, persoon, datum). */
export function receiptDescription(declaration: any, reference: string): string {
  const who = String(declaration?.board_member_name ?? "").replace(/\s+/g, " ").trim();
  const what = String(declaration?.declaration_type ?? "declaratie").trim();
  const date = String(declaration?.expense_date ?? "").slice(0, 10);
  return `${reference} | Declaratie ${what}${who ? ` ${who}` : ""}${date ? ` ${date}` : ""}`.slice(0, 250);
}
export type ListedDoc = { id: string; type: InformerDocType; ref: string[]; amount: number | null; date: string | null; paid?: number | null };
/** Exacte kenmerkmatch over beide namespaces; meer dan één treffer => throw (ambigu). */
export function matchReferenceAcross(reference: string, docs: ListedDoc[]): ListedDoc | null {
  const ref = reference.toUpperCase();
  const hits = docs.filter((d) => d.ref.includes(ref));
  if (hits.length > 1) throw new Error(`Meerdere Informer-documenten met kenmerk ${ref} (${hits.map((h) => `${h.type}:${h.id}`).join(", ")}); handmatig controleren`);
  return hits[0] ?? null;
}
const centsOf = (n: unknown) => Math.round(Math.abs(Number(n)) * 100);
/** Hergebruik alleen als lokale koppeling, soort, bedrag en datum exact passen. */
export function reuseMismatch(declaration: any, doc: InformerDocRef): string | null {
  if (declaration.informer_external_id && (String(declaration.informer_external_id) !== doc.id
      || (declaration.informer_doc_type && declaration.informer_doc_type !== doc.type))) {
    return "Lokaal gekoppeld Informer-document wijkt af van gevonden document";
  }
  if (doc.amount != null && centsOf(doc.amount) !== centsOf(declaration.amount)) return "Bestaand Informer-document heeft een ander bedrag";
  if (doc.date && declaration.expense_date && String(doc.date).slice(0, 10) !== String(declaration.expense_date).slice(0, 10)) return "Bestaand Informer-document heeft een andere datum";
  return null;
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

const normText = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Hergebruik een bestaande Informer-relatie (e-mail, IBAN of naam). Geeft numeriek id of "". */
export function findExistingSupplierId(
  relations: any[],
  who: { emails: unknown[]; iban?: unknown; name?: unknown },
): string {
  const emails = who.emails.map(normText).filter(Boolean);
  const iban = normText(who.iban).replace(/\s/g, "");
  const name = normText(who.name);
  const existing = (relations ?? []).find((relation: any) => {
    const relationEmails = [relation?.email, relation?.email_invoice].map(normText).filter(Boolean);
    const relationIban = normText(relation?.iban).replace(/\s/g, "");
    const relationName = normText(
      [relation?.firstname, relation?.surname_prefix, relation?.surname].filter(Boolean).join(" ")
        || relation?.company_name || relation?.name,
    );
    return emails.some((e) => relationEmails.includes(e)) || (!!iban && relationIban === iban) || (!!name && relationName === name);
  });
  const id = existing ? String(existing?.id ?? existing?.relation_id ?? "").trim() : "";
  return /^\d+$/.test(id) ? id : "";
}

// ---------------------------------------------------------------------------
// Informer relatie (leverancier) — payload volgens de officiële v2 OpenAPI-spec
// (https://api.informer.eu/docs/v2/api-docs.json, server https://api.informer.eu/v2,
// POST /relations, schema RelationInputPrivate = RelationInputBase + firstname/surname).
// v2: relation_type integer (1 = privé), verplicht street/house_number/zip/city/
// country + firstname/surname; company_name verboden bij privé; telefoon = "phone";
// subtype {supplier, active} is gedocumenteerd. 422 = { error: { veld: tekst } }.
// ---------------------------------------------------------------------------

export const RELATION_INPUT_FIELDS = [
  "relation_number", "relation_type", "company_name", "firstname", "surname_prefix", "surname",
  "street", "house_number", "house_number_suffix", "zip", "city", "country", "phone", "fax",
  "web", "email", "coc", "vat", "iban", "bic", "oin", "collection_number", "collection_date",
  "email_invoice", "sales_invoice_template_id", "payment_condition_id", "ubl_ledger_id",
  "subtype", "customfields",
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

export function buildSupplierRelationPayload(input: SupplierInput): Record<string, unknown> {
  const text = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
  const payload: Record<string, unknown> = { relation_type: 1 };
  const strings: Record<string, string> = {
    firstname: text(input.firstname),
    surname_prefix: text(input.surname_prefix),
    surname: text(input.surname),
    street: text(input.street),
    house_number: text(input.houseNumber),
    house_number_suffix: text(input.suffix),
    zip: text(input.zip).replace(/\s+/g, " ").toUpperCase(),
    city: text(input.city),
    country: "NL",
    email: text(input.email),
    email_invoice: text(input.email),
    phone: text(input.phone),
    iban: text(input.iban).replace(/\s+/g, "").toUpperCase(),
  };
  for (const [k, v] of Object.entries(strings)) if (v) payload[k] = v;
  payload.subtype = { supplier: 1, active: 1 };
  return payload;
}

const SAFE_CATEGORIES = ["verplicht", "ongeldig type", "ongeldig formaat", "afgekeurd"] as const;

function categorize(message: unknown): (typeof SAFE_CATEGORIES)[number] {
  const m = String(message ?? "").toLowerCase();
  if (/verplicht|required|missing|ontbreekt|mag niet leeg|cannot be empty/.test(m)) return "verplicht";
  if (/integer|numeric|number|getal|boolean|type|array|string/.test(m)) return "ongeldig type";
  if (/geldig|valid|format|formaat|datum|date|email|iban|url/.test(m)) return "ongeldig formaat";
  return "afgekeurd";
}

/**
 * Veilige admin-melding uit een Informer-foutantwoord. Neemt alleen bekende
 * veldnamen en een vaste categorie over — nooit vendortekst of ingevulde waarden
 * (geen namen, adressen, IBAN, e-mail, tokens of base64).
 */
export function describeInformerError(status: number | null | undefined, body: unknown): string | null {
  const known = new Set<string>(RELATION_INPUT_FIELDS as readonly string[]);
  const parts: string[] = [];
  const add = (field: string | undefined, message: unknown) => {
    const label = field && known.has(field) ? field : "onbekend veld";
    parts.push(`${label}: ${categorize(message)}`);
  };
  const walk = (value: unknown, field?: string) => {
    if (value == null) return;
    if (typeof value === "string" || typeof value === "number") { add(field, value); return; }
    if (Array.isArray(value)) { value.forEach((v) => walk(v, field)); return; }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const named = obj.field ?? obj.property;
      if (typeof named === "string") { add(named, obj.message ?? obj.error ?? ""); return; }
      for (const [k, v] of Object.entries(obj)) {
        if (["code", "status", "success", "url", "response_code"].includes(k)) continue;
        walk(v, k === "message" ? field : k);
      }
    }
  };
  const b = body as any;
  if (b && typeof b === "object" && !Array.isArray(b)) {
    walk(b.error ?? b.errors ?? b.validation_errors);
  } else if (body != null && body !== "") {
    walk(body);
  }
  const unique = [...new Set(parts)].slice(0, 10);
  if (unique.length) return `${status ? `HTTP ${status}: ` : ""}${unique.join("; ")}`;
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
  // Maandelijkse vrijwilligersvergoedingen (auto-monthly-allowances): vaste soorten per functie.
  penningmeester: { code: "4009", ledgerId: 15391211, description: "Vrijwilligersvergoedingen" },
  woordvoering: { code: "4009", ledgerId: 15391211, description: "Vrijwilligersvergoedingen" },
};

export const MONTHLY_ALLOWANCE_TYPES: readonly string[] = ["penningmeester", "woordvoering"];
export function isMonthlyAllowance(type: unknown): boolean {
  return MONTHLY_ALLOWANCE_TYPES.includes(String(type));
}

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
  const monthly = isMonthlyAllowance(declaration.declaration_type);
  if (!declaration.appointment && !monthly) return "Omschrijving ontbreekt";
  if (monthly && !declaration.expense_date) return "Maand van de vergoeding ontbreekt";
  // Kilometers en vaste maandvergoedingen hebben geen bon; overige reiskosten wel.
  if (declaration.declaration_type !== "reiskosten" && !monthly && declarationReceiptPaths(declaration).length === 0) {
    return "Bon ontbreekt; voeg eerst een bon toe";
  }
  return null;
}

export function declarationLineDescription(declaration: any, eventTitle: string | null): string {
  const monthly = isMonthlyAllowance(declaration.declaration_type);
  const kind = declaration.declaration_type === "reiskosten" ? "Kilometervergoeding"
    : declaration.declaration_type === "overig" ? "Overige reiskosten"
    : monthly ? `Vrijwilligersvergoeding ${declaration.declaration_type}` : "Declaratie";
  const period = monthly && declaration.expense_date ? `maand ${String(declaration.expense_date).slice(0, 7)}` : null;
  const parts = [
    `${kind}: ${declaration.appointment || period || declaration.board_member_name}`,
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
  if (!caller.userId && !caller.isServiceCall) return { allowed: false, status: 401, retry: false };
  // Indieners versturen nooit zelf: verzending volgt pas na goedkeuring door een beheerder.
  if (!caller.isServiceCall && !caller.isAdminOrTreasurer) return { allowed: false, status: 403, retry: false };
  if (!declaration || declaration.status !== "approved") return { allowed: false, status: 409, retry: false };
  return { allowed: true, status: 200, retry };
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
    // Alleen goedgekeurde declaraties gaan naar Informer; concept, ingediend of afgewezen nooit.
    if (declaration.status !== "approved") {
      return { success: false, error_message: "Declaratie is nog niet goedgekeurd", details: { declaration_id: declarationId, skipped: true, not_approved: true } };
    }
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
      const mismatch = reuseMismatch(declaration, existing);
      if (mismatch) throw new Error(mismatch);
      await store.markSent(declarationId, existing.id, existing.type);
      await store.resolveTodo(declarationId);
      return { success: true, details: { declaration_id: declarationId, reference, reused_existing: true, document_type: existing.type, document_id: existing.id } };
    }
    // Lokaal al een document-id maar remote niets gevonden: nooit opnieuw aanmaken.
    if (declaration.informer_external_id) throw new Error("Lokaal Informer-document niet teruggevonden; handmatig controleren, niets aangemaakt");
    const documentId = await informer.createReceipt(declaration, reference);
    await store.markSent(declarationId, documentId, "receipt");
    await store.resolveTodo(declarationId);
    return { success: true, details: { declaration_id: declarationId, reference, document_type: "receipt", document_id: documentId } };
  } catch (error) {
    const message = redactSensitive((error as Error)?.message ?? String(error)).slice(0, 500);
    if (claimed) await store.markError(declarationId, message);
    await store.recordTodo(declarationId, message);
    return { success: false, error_message: message, details: { declaration_id: declarationId } };
  }
}
