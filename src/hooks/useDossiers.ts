import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isSamePayment, invoiceNumbersIn, sharesInvoiceNumber, invoiceKeysOf } from "@/lib/ledgerDedupe";
import { matchLegacyRecords } from "@/lib/ledgerLegacy";
import { fetchLegacyRecords, fetchDocumentHints } from "@/lib/legacyRecordsSource";
import type { LedgerEntry } from "@/lib/ledger";
import { entryKeyVariants, parseLedgerEntryKey } from "@/lib/ledgerRowId";


export type DossierEntryKind = "expense" | "bank" | "ponto" | "ledger";

export interface DossierMutation {
  /** Unieke sleutel, ook gebruikt om documenten te koppelen: "expense:uuid" etc. */
  key: string;
  kind: DossierEntryKind;
  id: string;
  /** Algemene sorteerdatum; voor facturen de factuurdatum, voor bankregels de betaaldatum. */
  date: string | null;
  /** Datum op de factuur/boeking uit Informer of een handmatige import. */
  invoiceDate: string | null;
  /** Bedrag volgens de factuurboeking (kan afwijken van de bankafschrijving). */
  invoiceAmount: number | null;

  paymentDate: string | null;
  counterparty: string;
  description: string;
  invoice: string;
  amount: number;
  direction: "in" | "out";
  categoryName: string;
  lineItemName: string;
  dossier: string;
  source: string;
  /** Verdeling over meerdere dossiers; leeg = één dossier (veld `dossier`). */
  splits: { dossier: string; amount: number }[];
  /**
   * Sleutels van gekoppelde bestaande boekingen/bankmutaties ("expense:uuid",
   * "ponto:uuid"). Uitsluitend om bestaande documenten terug te vinden; de
   * Informer-regel blijft de hoofdregel en de bron van het bedrag.
   */
  legacyKeys?: string[];
  /**
   * Bestaande administratieve mutatie die (nog) niet aan een Informer-regel
   * gekoppeld kon worden. Blijft zichtbaar, maar telt niet mee in de
   * boekhoudkundige dossiertotalen.
   */
  unlinked?: boolean;
  /**
   * Lokale mutatie met een eigen begrotingspost/dossier die niet aan een
   * Informer-factuur te koppelen is. Telt exact één keer mee in het
   * managementoverzicht, maar nooit in Controle & sync.
   */
  localOnly?: boolean;
}

export interface ExpenseDocument {
  id: string;
  entry_key: string;
  dossier: string | null;
  year: number | null;
  file_path: string;
  file_name: string;
  mime_type: string | null;
  source: string;
  invoice_reference: string | null;
  created_at: string;
}

export interface DossierSplit {
  id: string;
  entry_key: string;
  dossier: string;
  amount: number;
  year: number | null;
}

/** Mutatie zoals getoond binnen één dossier: met het deel dat aan dat dossier toebehoort. */
export type DossierEntry = DossierMutation & { shareAmount: number; shared: boolean };

/** Groepeert mutaties per dossier; gesplitste kosten tellen per dossier alleen hun deel mee. */
export function groupByDossier(mutations: DossierMutation[]) {
  const map = new Map<string, DossierEntry[]>();
  const push = (dossier: string, entry: DossierEntry) => {
    if (!dossier) return;
    if (!map.has(dossier)) map.set(dossier, []);
    map.get(dossier)!.push(entry);
  };
  for (const m of mutations) {
    if (m.splits && m.splits.length > 0) {
      for (const s of m.splits) {
        push(s.dossier, { ...m, shareAmount: s.amount, shared: m.splits.length > 1 });
      }
    } else if (m.dossier) {
      push(m.dossier, { ...m, shareAmount: m.amount, shared: false });
    }
  }
  return map;
}

/**
 * Vindt toewijzingen die hetzelfde factuurnummer binnen één dossier dubbel laten
 * meetellen: een verdeeld deel van een betaling én een losse betaling met
 * hetzelfde factuurnummer. Geeft de sleutels van de verdeelde regels terug.
 */
export function duplicateAllocationKeys(entries: { key: string; shared?: boolean; splits?: { dossier: string }[]; invoice: string; description: string; date: string | null; amount: number }[]): Set<string> {
  const numbersOf = (e: { invoice: string; description: string }) =>
    new Set([...invoiceNumbersIn(e.invoice), ...invoiceNumbersIn(e.description)].map((n) => n.toLowerCase()));
  const flagged = new Set<string>();
  for (const e of entries) {
    const isSplit = (e.splits?.length || 0) > 0;
    if (!isSplit) continue;
    const mine = numbersOf(e);
    if (mine.size === 0) continue;
    for (const other of entries) {
      if (other.key === e.key) continue;
      if ((other.splits?.length || 0) > 0) continue;
      for (const n of numbersOf(other)) {
        if (mine.has(n)) flagged.add(e.key);
      }
    }
  }
  return flagged;
}

/**
 * Alle sleutels waaronder documenten van deze regel kunnen hangen: de eigen
 * sleutel, de samengevoegde bronnen en de gekoppelde legacy-aliassen.
 */
export function documentKeysOf(entry: {
  key: string;
  legacyKeys?: string[];
  sources?: { key: string; legacyKeys?: string[] }[];
}): string[] {
  const keys = new Set<string>();
  const add = (k: string) => {
    for (const v of entryKeyVariants(k)) keys.add(v);
  };
  add(entry.key);
  for (const k of entry.legacyKeys || []) add(k);
  for (const s of entry.sources || []) {
    add(s.key);
    for (const k of s.legacyKeys || []) add(k);
  }
  return [...keys];
}

/** True als deze mutatie aan geen enkel dossier hangt (ook niet via een verdeling). */
export function isUnassigned(m: DossierMutation) {
  return !m.dossier && (!m.splits || m.splits.length === 0);
}

/**
 * Zelfde kosten die zowel via de bank als via Informer binnenkomen worden als
 * één regel getoond. `sources` bevat alle onderliggende boekingen.
 * De bankboeking (Ponto) is leidend; Informer/handmatig wordt eraan gehangen.
 */
export type DedupedEntry = DossierEntry & {
  sources: DossierEntry[];
  /** Toelichting bij een samengevoegde correctie, bv. een dubbele betaling. */
  note?: string;
  /** Factuurbedragen per factuurnummer, zodat niets dubbel wordt geteld. */
  invoiceAmountByKey?: Record<string, number>;
};

/** Sleutel waaronder het factuurbedrag van een bron wordt bewaard. */
function amountKeyFor(e: DossierEntry): string {
  const keys = invoiceKeysOf({
    date: e.date,
    amount: e.amount,
    invoice: e.invoice,
    description: e.description,
  });
  return keys[0] || `entry:${e.key}`;
}

const formatNlDate = (value?: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toLocaleDateString("nl-NL");
};

export function dedupeEntries(entries: DossierEntry[]): DedupedEntry[] {
  // Bankregels eerst, zodat die de "hoofdregel" worden.
  const ordered = [...entries].sort((a, b) => (b.kind === "ponto" ? 1 : 0) - (a.kind === "ponto" ? 1 : 0));
  const result: DedupedEntry[] = [];
  for (const e of ordered) {
    const self = { date: e.date, amount: e.shareAmount, counterparty: e.counterparty, description: e.description, invoice: e.invoice, direction: e.direction };
    const asLedger = (r: DedupedEntry) => ({ date: r.date, amount: r.shareAmount, counterparty: r.counterparty, description: r.description, invoice: r.invoice, direction: r.direction });
    // Twee losse bankafschrijvingen zijn nooit dezelfde betaling; alleen een
    // bankregel en een factuurboeking worden samengevoegd.
    const match =
      e.kind === "ponto"
        ? undefined
        : result.find((r) => {
            const other = asLedger(r);
            if (r.kind === "ponto" && isSamePayment(other, self)) return true;
            // Een bankbetaling bundelt vaak meerdere facturen of verrekent een
            // creditnota; dan wijkt het bedrag af maar is het dezelfde betaling.
            return r.kind === "ponto" && sharesInvoiceNumber(other, self);
          });
    // Terugstorting van een dubbele betaling: zelfde factuur, zelfde bedrag,
    // tegengestelde richting. Samenvoegen met de meest recente betaling ervoor.
    const refundOf = match
      ? undefined
      : result
          .filter(
            (r) =>
              r.direction !== e.direction &&
              Math.abs(Math.abs(r.shareAmount) - Math.abs(e.shareAmount)) <= 0.5 &&
              sharesInvoiceNumber(asLedger(r), self),
          )
          .sort((a, b) => (a.date || "").localeCompare(b.date || ""))
          .pop();
    if (refundOf) {
      // Betaling en terugstorting salderen; de regel blijft zichtbaar met notitie.
      refundOf.sources.push(e);
      refundOf.shareAmount = refundOf.shareAmount - Math.abs(e.shareAmount);
      refundOf.amount = refundOf.shareAmount;
      refundOf.note = `Dubbele betaling — teruggestort op ${formatNlDate(e.paymentDate || e.date)}`;
      continue;
    }
    if (match) {
      match.sources.push(e);

      if (!match.invoiceDate && e.invoiceDate) match.invoiceDate = e.invoiceDate;
      if (!match.paymentDate && e.paymentDate) match.paymentDate = e.paymentDate;
      // Factuurbedrag per factuurnummer bewaren: hetzelfde nummer dat zowel via
      // de bank als via Informer binnenkomt telt maar één keer mee.
      const amounts = match.invoiceAmountByKey || {};
      const key = amountKeyFor(e);
      const value = e.kind === "ponto" ? e.invoiceAmount : e.invoiceAmount ?? e.shareAmount;
      if (value != null) amounts[key] = Math.max(amounts[key] ?? 0, Math.abs(value));
      match.invoiceAmountByKey = amounts;
      const total = Object.values(amounts).reduce((s, v) => s + v, 0);
      match.invoiceAmount = total > 0 ? total : match.invoiceAmount;
      // Alle factuurnummers van de samengevoegde bronnen tonen.
      const nums = new Set(
        [...match.invoice.split(/\s*[,·]\s*/), ...e.invoice.split(/\s*[,·]\s*/)].filter(Boolean),
      );
      match.invoice = [...nums].join(", ");
      if (!match.counterparty && e.counterparty) match.counterparty = e.counterparty;
      if (!match.lineItemName && e.lineItemName) {
        match.lineItemName = e.lineItemName;
        match.categoryName = e.categoryName;
      }
    } else {
      const value = e.kind === "ponto" ? e.invoiceAmount : e.invoiceAmount ?? e.shareAmount;
      result.push({
        ...e,
        invoiceAmount: value,
        invoiceAmountByKey: value != null ? { [amountKeyFor(e)]: Math.abs(value) } : {},
        sources: [e],
      });
    }
  }
  result.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return result;
}




const client = supabase as any;

export function entryKeyFor(kind: DossierEntryKind, id: string) {
  return `${kind}:${id}`;
}

/** Alle dossierverdelingen (kosten die over meerdere dossiers zijn verdeeld). */
export function useDossierSplits() {
  return useQuery({
    queryKey: ["dossier-splits"],
    queryFn: async () => {
      const { data, error } = await client.from("expense_dossier_splits").select("*");
      if (error) throw error;
      return (data || []).map((s: any) => ({ ...s, amount: Number(s.amount) || 0 })) as DossierSplit[];
    },
  });
}

export function useDossierSplitActions() {
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async ({
      entryKey,
      splits,
      year,
    }: {
      entryKey: string;
      splits: { dossier: string; amount: number }[];
      year: number;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error: delErr } = await client.from("expense_dossier_splits").delete().eq("entry_key", entryKey);
      if (delErr) throw delErr;
      const rows = splits
        .filter((s) => s.dossier.trim() && Number.isFinite(s.amount))
        .map((s) => ({
          entry_key: entryKey,
          dossier: s.dossier.trim(),
          amount: s.amount,
          year,
          created_by: auth?.user?.id ?? null,
        }));
      if (rows.length > 0) {
        const { error } = await client.from("expense_dossier_splits").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dossier-splits"] });
      qc.invalidateQueries({ queryKey: ["dossier-mutations"] });
    },
  });

  return { save };
}

/** Alle mutaties (uitgaven, inkomsten, bankboekingen) van een jaar — ook zonder begrotingspost. */
export function useDossierMutations(year: number) {
  return useQuery({
    queryKey: ["dossier-mutations", year],
    queryFn: async () => {
      const { data: categories, error: catErr } = await client
        .from("budget_categories")
        .select("id, name")
        .eq("year", year);
      if (catErr) throw catErr;

      const catIds = (categories || []).map((c: any) => c.id);
      const catNameById = new Map<string, string>((categories || []).map((c: any) => [c.id, c.name]));

      let lineItems: any[] = [];
      if (catIds.length > 0) {
        const { data, error } = await client
          .from("budget_line_items")
          .select("id, name, category_id")
          .in("category_id", catIds);
        if (error) throw error;
        lineItems = data || [];
      }
      const liById = new Map<string, any>(lineItems.map((li: any) => [li.id, li]));
      const liIds = lineItems.map((li: any) => li.id);

      const names = (lineItemId: string | null) => {
        const li = lineItemId ? liById.get(lineItemId) : null;
        return {
          lineItemName: li?.name || "",
          categoryName: li ? catNameById.get(li.category_id) || "" : "",
        };
      };

      const rows: DossierMutation[] = [];

      const { data: splitRows, error: splitErr } = await client
        .from("expense_dossier_splits")
        .select("entry_key, dossier, amount");
      if (splitErr) throw splitErr;
      const splitsByEntry = new Map<string, { dossier: string; amount: number }[]>();
      for (const s of splitRows || []) {
        const list = splitsByEntry.get(s.entry_key) || [];
        list.push({ dossier: String(s.dossier), amount: Number(s.amount) || 0 });
        splitsByEntry.set(s.entry_key, list);
      }
      // Canonieke Informer-regels kunnen historisch onder een geprefixte
      // sleutel zijn opgeslagen; we lezen alle varianten, schrijven canoniek.
      const splitsFor = (key: string) => {
        for (const variant of entryKeyVariants(key)) {
          const hit = splitsByEntry.get(variant);
          if (hit && hit.length > 0) return hit;
        }
        return [];
      };

      // Bedragen, facturen en betaalstatus komen uitsluitend uit de boekhouding.
      // Elke regel hangt aan een stabiele Informer-ID en telt exact eenmaal.
      // De bestaande administratie levert alleen de toewijzing (begrotingspost,
      // dossier, splits en documenten).
      const { data: ledgerRows, error: ledgerErr } = await client
        .from("ledger_entries_v")
        .select("*")
        .eq("year", year)
        .limit(5000);
      if (ledgerErr) throw ledgerErr;

      const [legacyRecords, documentHints] = await Promise.all([
        fetchLegacyRecords(year, liIds),
        fetchDocumentHints(year),
      ]);
      const matched = matchLegacyRecords((ledgerRows || []) as LedgerEntry[], legacyRecords, {
        documentHints,
      });

      for (const e of ledgerRows || []) {
        if (!e.counts_in_totals) continue;
        const amount = Math.abs(Number(e.amount_incl) || 0);
        const ledgerKey = `${e.doc_type}:${e.informer_id}`;
        const key = entryKeyFor("ledger", ledgerKey);
        const direct = matched.byEntryKey.get(ledgerKey) || null;
        // Eén bankbetaling die meerdere facturen dekt levert ook de
        // administratieve toewijzing; de betaling zelf telt niet apart mee.
        const grouped = matched.combinedByEntryKey.get(ledgerKey) || null;
        const legacy = direct || grouped;
        const lineItemId =
          e.line_item_id ||
          (legacy?.lineItemId && liById.has(legacy.lineItemId) ? legacy.lineItemId : null);
        const lineItemName = lineItemId ? liById.get(lineItemId)?.name || "" : "";
        const aliases = matched.aliasesByEntryKey.get(ledgerKey) || [];
        const legacyKeys = [legacy?.key, ...aliases.map((a) => a.key)].filter(
          (k): k is string => !!k,
        );
        const ownSplits = splitsFor(key);
        // Bij een gecombineerde of gesplitste betaling gelden de splits van die
        // betaling niet per factuur: die zouden dan meerdere keren meetellen.
        // Bij een splitmatch levert de mutatie alleen het dossier van het
        // bijbehorende deel (zit al in `legacy.dossier`).
        const viaSplit = matched.matchedBy.get(ledgerKey) === "split";
        const splits =
          ownSplits.length > 0
            ? ownSplits
            : grouped || viaSplit
              ? []
              : legacyKeys.map((k) => splitsFor(k)).find((s) => s.length > 0) || [];

        rows.push({
          key,
          kind: "ledger",
          id: String(e.informer_id),
          date: e.entry_date,
          invoiceDate: e.entry_date,
          invoiceAmount: amount,
          paymentDate: e.payment_date ? String(e.payment_date).slice(0, 10) : null,
          counterparty: e.relation_name || "",
          description: e.description || e.ledger_account || "",
          invoice: e.invoice_number || "",
          amount,
          direction: e.doc_type === "sales_invoice" ? "in" : "out",
          lineItemName,
          categoryName: lineItemName
            ? catNameById.get(liById.get(lineItemId)?.category_id) || ""
            : "",
          dossier: (
            e.dossier ||
            legacy?.dossier ||
            aliases.find((a) => a.dossier)?.dossier ||
            ""
          ).trim(),
          source: "informer",
          splits,
          legacyKeys,
        });
      }

      // Bestaande administratieve mutaties zonder Informer-koppeling. Alleen een
      // bankmutatie (Ponto) met zowel een begrotingspost als een dossier is een
      // werkelijk aanvullende mutatie: die telt exact één keer mee in het
      // managementtotaal. Oude boekingen zonder koppeling blijven zichtbaar als
      // aandachtspunt en tellen niet mee.
      for (const r of matched.unmatched) {
        const splits = splitsFor(r.key).length > 0 ? splitsFor(r.key) : r.splits || [];
        if (!r.dossier && splits.length === 0) continue;
        const lineItemName = r.lineItemId ? liById.get(r.lineItemId)?.name || "" : "";
        const counts =
          r.kind === "ponto" && !!r.lineItemId && (!!r.dossier || splits.length > 0);
        rows.push({
          key: r.key,
          kind: r.kind,
          id: r.id,
          date: r.date,
          invoiceDate: r.date,
          invoiceAmount: r.amount,
          paymentDate: r.kind === "ponto" ? r.date : null,
          counterparty: r.counterparty || "",
          description: r.description || "",
          invoice: r.invoice || "",
          amount: r.amount,
          direction: r.direction,
          lineItemName,
          categoryName: lineItemName
            ? catNameById.get(liById.get(r.lineItemId!)?.category_id) || ""
            : "",
          dossier: r.dossier || "",
          source: r.kind === "ponto" ? "bank" : "administratie",
          splits,
          localOnly: counts,
          // Een aanvullende lokale mutatie telt mee in het managementtotaal;
          // zonder volledige toewijzing blijft de regel zichtbaar maar telt niet.
          unlinked: !counts,
        });
      }


      rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      return rows;
    },
  });
}

export function useDossierMutationActions(year: number) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["dossier-mutations", year] });
    qc.invalidateQueries({ queryKey: ["budget-categories", year] });
  };

  const setDossier = useMutation({
    mutationFn: async ({ entries, dossier }: { entries: DossierMutation[]; dossier: string | null }) => {
      for (const entry of entries) {
        if (entry.kind === "ledger") {
          // Blijft bewaard na synchronisatie: hangt aan de stabiele Informer-ID.
          const [docType, informerId] = entry.key.replace(/^ledger:/, "").split(":");
          const { error } = await client
            .from("ledger_entry_overrides")
            .upsert(
              { doc_type: docType, informer_id: informerId, dossier },
              { onConflict: "doc_type,informer_id" },
            );
          if (error) throw error;
          continue;
        }
        const table =
          entry.kind === "expense" ? "budget_expenses" : entry.kind === "bank" ? "bank_transactions" : "ponto_transactions";
        const { error } = await client.from(table).update({ dossier }).eq("id", entry.id);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  return { setDossier };
}

export function useExpenseDocuments() {
  return useQuery({
    queryKey: ["expense-documents"],
    queryFn: async () => {
      const { data, error } = await client
        .from("expense_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ExpenseDocument[];
    },
  });
}

export function useExpenseDocumentActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["expense-documents"] });

  const upload = useMutation({
    mutationFn: async ({
      entry,
      files,
      year,
    }: {
      entry: DossierMutation;
      files: File[];
      year: number;
    }) => {
      const { data: auth } = await supabase.auth.getUser();
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${year}/${entry.kind}/${entry.id}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("expense-invoices")
          .upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (upErr) throw upErr;
        const { error } = await client.from("expense_documents").insert({
          entry_key: entry.key,
          dossier: entry.dossier || null,
          year,
          file_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          source: "manual",
          invoice_reference: entry.invoice || null,
          uploaded_by: auth?.user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (doc: ExpenseDocument) => {
      // Zelfde bestand kan aan meerdere boekingen hangen; alleen de laatste koppeling wist het bestand.
      const { data: siblings } = await client
        .from("expense_documents")
        .select("id")
        .eq("file_path", doc.file_path);
      const { error } = await client.from("expense_documents").delete().eq("id", doc.id);
      if (error) throw error;
      if ((siblings || []).length <= 1) {
        await supabase.storage.from("expense-invoices").remove([doc.file_path]);
      }
    },
    onSuccess: invalidate,
  });

  /** Hangt een bestaande factuur aan een andere mutatie binnen hetzelfde dossier. */
  const relink = useMutation({
    mutationFn: async ({ doc, entryKey }: { doc: ExpenseDocument; entryKey: string }) => {
      const { error } = await client
        .from("expense_documents")
        .update({ entry_key: entryKey })
        .eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { upload, remove, relink };
}

export async function getDocumentUrl(path: string) {
  const { data, error } = await supabase.storage.from("expense-invoices").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
