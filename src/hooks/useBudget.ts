import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isExcludedDossier } from "@/lib/budgetExclusions";
import { isSamePayment, invoiceKeysOf, sharesInvoiceNumber } from "@/lib/ledgerDedupe";
import { expenseEntries, revenueEntries, type LedgerEntry } from "@/lib/ledger";

/** Synthetische categorie voor meetellende inkoopfacturen zonder begrotingspost. */
export const UNASSIGNED_CATEGORY_ID = "__unassigned_ledger__";
export const UNASSIGNED_LINE_ITEM_ID = "__unassigned_ledger_line__";


export interface BudgetCategory {
  id: string;
  year: number;
  name: string;
  sort_order: number;
  line_items: BudgetLineItem[];
}

export interface BudgetLineItem {
  id: string;
  category_id: string;
  name: string;
  budgeted_amount: number;
  sort_order: number;
  expenses: BudgetExpense[];
}

export interface BudgetExpense {
  id: string;
  line_item_id: string;
  description: string | null;
  amount: number;
  expense_date: string | null;
  creditor_name: string | null;
  invoice_reference: string | null;
  dossier: string | null;
  source: string;
  pdf_file_path: string | null;
  paid: boolean;
  paid_date: string | null;
  created_at: string;
  direction?: "in" | "out";
  /** True als er een dubbele boeking van dezelfde betaling is samengevoegd. */
  _mergedDuplicate?: boolean;
}


export interface BudgetBalanceItem {
  id: string;
  year: number;
  name: string;
  amount: number;
  section: string;
  sort_order: number;
  side: string;
}

export interface BankTransaction {
  id: string;
  upload_id: string;
  year: number;
  row_index: number;
  transaction_date: string | null;
  direction: "in" | "out";
  counterparty: string | null;
  description: string | null;
  invoice_reference: string | null;
  amount: number;
  row_hash: string;
  created_at: string;
  line_item_id: string | null;
  dossier: string | null;
}

export interface BankStatementUpload {
  id: string;
  year: number;
  file_name: string;
  opening_balance: number | null;
  closing_balance: number | null;
  imported_by: string;
  created_at: string;
}

export interface BankStatementData {
  upload: BankStatementUpload | null;
  transactions: BankTransaction[];
  totalIn: number;
  totalOut: number;
  netMutation: number;
}

export interface FinancialResultData {
  contributionIncome: number;
  otherIncome: number;
  totalExpenses: number;
  /** Openstaand bedrag verkoopfacturen volgens de boekhouding. */
  openSales: number;
  /** Openstaand bedrag inkoopfacturen volgens de boekhouding. */
  openPurchase: number;
}

export type ExpenseSourcePreference = "manual" | "pdf_import";

const normalizeInvoiceKey = (value?: string | null) =>
  (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const normalizePartyKey = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .replace(/\b(via|bv|b\.v\.|vof|v\.o\.f\.|nv|n\.v\.)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);

const dayNumber = (value?: string | null) => {
  const timestamp = value ? new Date(value).getTime() : NaN;
  return Number.isNaN(timestamp) ? 0 : Math.floor(timestamp / 86_400_000);
};

const extractInvoiceReference = (...parts: Array<string | null | undefined>) => {
  const text = parts.filter(Boolean).join(" ");
  if (!text) return null;

  const patterns = [
    /(?:fact(?:uur)?\.?\s*(?:n\.?r\.?|nr\.?|nummer)?|factuurnummer|invoice|reminfo|remi|eref)\s*[:/#-]?\s*(20\d{2})\s*[- ]\s*(\d{2,6})/i,
    /\b(20\d{2})\s*[- ]\s*(\d{3,6})\b/i,
    // Contigue nummers zoals "Declaratienummer:20261238" of "factuurnr 20261238"
    /(?:fact(?:uur)?\.?\s*(?:n\.?r\.?|nr\.?|nummer)?|factuurnummer|declaratienummer|declaratie(?:\s*nr\.?)?|invoice|reminfo|remi|eref)\s*[:/#-]?\s*(20\d{2})(\d{3,6})\b/i,
    // Losstaand 20YY-nummer met minimaal 4 aansluitende cijfers (bv. 20261238)
    /\b(20\d{2})(\d{4,6})\b/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1] && match?.[2]) {
      return `${match[1]}-${match[2]}`;
    }
  }

  return null;
};

export function useBudgetCategories(year: number) {
  return useQuery({
    queryKey: ["budget-categories", year],
    queryFn: async () => {
      const { data: categories, error } = await supabase
        .from("budget_categories")
        .select("*")
        .eq("year", year)
        .order("sort_order");
      if (error) throw error;

      const { data: lineItems, error: liError } = await supabase
        .from("budget_line_items")
        .select("*")
        .in("category_id", categories.map((c: any) => c.id))
        .order("sort_order");
      if (liError) throw liError;

      // Werkelijke bedragen komen uitsluitend uit de boekhouding (canonieke
      // regels in ledger_entries_v). Bankmutaties (Ponto) en de oude
      // PDF-/handmatige boekingen tellen niet meer mee: zij kunnen hooguit als
      // betaling aan een boekhoudregel gekoppeld zijn.
      const client = supabase as any;
      const { data: ledgerRows, error: ledgerErr } = await client
        .from("ledger_entries_v")
        .select("*")
        .eq("year", year)
        .limit(5000);
      if (ledgerErr) throw ledgerErr;

      // Exact dezelfde canonieke selectie én toewijzing als het resultaat en de
      // controlemodule: override > eenduidige kostenrubriek > "Niet toegewezen".
      // Elke meetellende inkoopfactuur zit daardoor in precies één bak.
      const buckets = bucketExpenseEntries(
        (ledgerRows || []) as LedgerEntry[],
        (lineItems || []).map((li: any) => ({ id: li.id, name: String(li.name) })),
      );

      const toRow = (e: LedgerEntry, lineItemId: string) => ({
        id: `ledger:${e.doc_type}:${e.informer_id}`,
        line_item_id: lineItemId,
        description: e.description || e.relation_name || e.invoice_number,
        // Teken behouden: een creditnota verlaagt de werkelijke uitgaven.
        amount: expenseAmount(e),
        expense_date: e.entry_date,
        creditor_name: e.relation_name,
        invoice_reference: e.invoice_number,
        dossier: e.dossier,
        source: "informer",
        pdf_file_path: null,
        paid: e.status === "paid",
        paid_date: e.payment_date ?? null,
        created_at: e.entry_date,
        direction: "out" as const,
        _fromLedger: true,
      });

      const expensesByLineItem: Record<string, any[]> = {};
      for (const [lineItemId, list] of Object.entries(buckets.byLineItem)) {
        expensesByLineItem[lineItemId] = list.map((e) => toRow(e, lineItemId));
      }
      const unassigned = buckets.unassigned.map((e) => toRow(e, UNASSIGNED_LINE_ITEM_ID));

      const lineItemsByCategory: Record<string, any[]> = {};
      for (const li of lineItems || []) {
        if (!lineItemsByCategory[li.category_id]) lineItemsByCategory[li.category_id] = [];
        lineItemsByCategory[li.category_id].push({
          ...li,
          budgeted_amount: Number(li.budgeted_amount),
          expenses: (expensesByLineItem[li.id] || []).map((e: any) => ({ ...e, amount: Number(e.amount) })),
        });
      }

      const result = (categories || []).map((c: any) => ({
        ...c,
        line_items: lineItemsByCategory[c.id] || [],
      })) as BudgetCategory[];

      if (unassigned.length > 0) {
        result.push({
          id: UNASSIGNED_CATEGORY_ID,
          year,
          name: "Niet toegewezen (boekhouding)",
          sort_order: 9999,
          line_items: [
            {
              id: UNASSIGNED_LINE_ITEM_ID,
              category_id: UNASSIGNED_CATEGORY_ID,
              name: "Nog geen begrotingspost gekoppeld",
              budgeted_amount: 0,
              sort_order: 0,
              expenses: unassigned,
            },
          ],
        } as BudgetCategory);
      }

      return result;
    },
  });
}

export function useBudgetBalance(year: number) {
  return useQuery({
    queryKey: ["budget-balance", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_balance_items")
        .select("*")
        .eq("year", year)
        .order("sort_order");
      if (error) throw error;
      return (data || []).map((b: any) => ({ ...b, amount: Number(b.amount) })) as BudgetBalanceItem[];
    },
  });
}

export function useBankStatement(year: number) {
  return useQuery({
    queryKey: ["bank-statement", year],
    queryFn: async () => {
      const client = supabase as any;
      const { data: uploads, error: uploadError } = await client
        .from("bank_statement_uploads")
        .select("*")
        .eq("year", year)
        .order("created_at", { ascending: false })
        .limit(1);
      if (uploadError) throw uploadError;

      const upload = uploads?.[0] ?? null;
      if (!upload) {
        return { upload: null, transactions: [], totalIn: 0, totalOut: 0, netMutation: 0 } as BankStatementData;
      }

      const { data, error } = await client
        .from("bank_transactions")
        .select("*")
        .eq("upload_id", upload.id)
        .order("row_index", { ascending: true });
      if (error) throw error;

      const transactions = (data || []).map((t: any) => ({ ...t, amount: Number(t.amount) })) as BankTransaction[];
      const totalIn = transactions.filter((t) => t.direction === "in").reduce((s, t) => s + t.amount, 0);
      const totalOut = transactions.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);

      return {
        upload: {
          ...upload,
          opening_balance: upload.opening_balance === null ? null : Number(upload.opening_balance),
          closing_balance: upload.closing_balance === null ? null : Number(upload.closing_balance),
        },
        transactions,
        totalIn,
        totalOut,
        netMutation: totalIn - totalOut,
      } as BankStatementData;
    },
  });
}

/**
 * Werkelijk resultaat. Uitsluitend gebaseerd op de canonieke Informer-regels
 * (ledger_entries_v); bankmutaties tellen hier nooit zelfstandig in mee.
 */
export function useFinancialResult(year: number) {
  return useQuery({
    queryKey: ["financial-result", "ledger", year],
    queryFn: async () => {
      const client = supabase as any;
      const [{ data, error }, { data: debtorMap }] = await Promise.all([
        client.from("ledger_entries_v").select("*").eq("year", year).limit(5000),
        client.from("informer_debtor_map").select("informer_debtor_id"),
      ]);
      if (error) throw error;
      const memberRelations = new Set<string>(
        (debtorMap ?? []).map((r: any) => String(r.informer_debtor_id)),
      );

      const rows = (data ?? []) as LedgerEntry[];
      const totals: FinancialResultData = {
        contributionIncome: 0,
        otherIncome: 0,
        totalExpenses: 0,
        openSales: 0,
        openPurchase: 0,
      };
      for (const entry of expenseEntries(rows)) {
        totals.totalExpenses += Number(entry.amount_incl) || 0;
        totals.openPurchase += Number(entry.open_amount) || 0;
      }
      for (const entry of revenueEntries(rows)) {
        const amount = Number(entry.amount_incl) || 0;
        totals.openSales += Number(entry.open_amount) || 0;
        if (
          memberRelations.has(String(entry.relation_id)) ||
          /contributie/i.test(String(entry.description ?? entry.dossier ?? ""))
        ) {
          totals.contributionIncome += amount;
        } else {
          totals.otherIncome += amount;
        }
      }
      return totals;
    },
  });
}

export function useBudgetMutations(year: number) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["budget-categories", year] });
    qc.invalidateQueries({ queryKey: ["budget-balance", year] });
    qc.invalidateQueries({ queryKey: ["bank-statement", year] });
  };

  const addCategory = useMutation({
    mutationFn: async (name: string) => {
      const { data: existing } = await supabase
        .from("budget_categories")
        .select("sort_order")
        .eq("year", year)
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;
      const { error } = await supabase.from("budget_categories").insert({ year, name, sort_order: nextOrder });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addLineItem = useMutation({
    mutationFn: async ({ categoryId, name, amount }: { categoryId: string; name: string; amount: number }) => {
      const { data: existing } = await supabase
        .from("budget_line_items")
        .select("sort_order")
        .eq("category_id", categoryId)
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;
      const { error } = await supabase.from("budget_line_items").insert({
        category_id: categoryId,
        name,
        budgeted_amount: amount,
        sort_order: nextOrder,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateLineItem = useMutation({
    mutationFn: async ({ id, name, amount }: { id: string; name?: string; amount?: number }) => {
      const updates: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updates.name = name;
      if (amount !== undefined) updates.budgeted_amount = amount;
      const { error } = await supabase.from("budget_line_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteLineItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_line_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addExpense = useMutation({
    mutationFn: async (expense: { line_item_id: string; description?: string; amount: number; expense_date?: string; creditor_name?: string; invoice_reference?: string; dossier?: string; created_by: string; paid?: boolean; paid_date?: string | null; direction?: "out" }) => {
      const direction = expense.direction ?? "out";
      const normalizeText = (value?: string | null) =>
        (value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
      const normalizedCreditor = normalizeText(expense.creditor_name || expense.description);
      const normalizedInvoice = normalizeText(expense.invoice_reference);
      const amountCents = Math.round((Number(expense.amount) || 0) * 100);
      const hasSharedToken = (a: string, b: string) => {
        if (!a || !b) return false;
        if (a === b || a.includes(b) || b.includes(a)) return true;
        const tokens = new Set(a.split(" ").filter((t) => t.length >= 4));
        return b.split(" ").some((t) => t.length >= 4 && tokens.has(t));
      };

      // Per-rij dedup vóór schrijven. Bij her-upload moet een bestaande boeking
      // worden overschreven/bijgewerkt, niet nogmaals aangemaakt. Daarom matchen we
      // niet alleen exact op bedrag, maar ook op dezelfde factuur op dezelfde datum.
      let candidateQuery = supabase
        .from("budget_expenses")
        .select("id, amount, creditor_name, description, invoice_reference, dossier")
        .eq("line_item_id", expense.line_item_id)
        .eq("direction", direction)
        .limit(50);
      candidateQuery = expense.expense_date
        ? candidateQuery.eq("expense_date", expense.expense_date)
        : candidateQuery.is("expense_date", null);

      const { data: candidates, error: candidateError } = await candidateQuery;
      if (candidateError) throw candidateError;

      const duplicate = (candidates || []).find((row: any) => {
        const rowCreditor = normalizeText(row.creditor_name || row.description);
        const rowInvoice = normalizeText(row.invoice_reference);
        const sameInvoice = !!normalizedInvoice && normalizedInvoice === rowInvoice;
        const sameAmount = Math.round((Number(row.amount) || 0) * 100) === amountCents;
        const sameCreditor = hasSharedToken(normalizedCreditor, rowCreditor);
        return (sameInvoice && (sameCreditor || !rowCreditor || !normalizedCreditor)) || (sameAmount && sameCreditor);
      });

      if (duplicate) {
        const { error: updateError } = await supabase
          .from("budget_expenses")
          .update({
            ...expense,
            direction,
            // Handmatige koppelingen blijven leidend: bestaand dossier niet leegmaken
            // als de nieuwe import geen dossier bevat.
            dossier: expense.dossier ?? duplicate.dossier ?? null,
          })
          .eq("id", duplicate.id);
        if (updateError) throw updateError;
        return;
      }

      const { error } = await supabase.from("budget_expenses").insert({ ...expense, direction });
      // DB unique-index als laatste vangnet (race conditions bij parallelle imports)
      if (error?.code === "23505" && error.message?.includes("budget_expenses_payment_dedup_idx")) return;
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateExpense = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; dossier?: string | null; line_item_id?: string; paid?: boolean; paid_date?: string | null; direction?: "in" | "out" }) => {
      const { error } = await supabase.from("budget_expenses").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const toggleExpensePaid = useMutation({
    mutationFn: async ({ id, paid }: { id: string; paid: boolean }) => {
      const { error } = await supabase.from("budget_expenses").update({
        paid,
        paid_date: paid ? new Date().toISOString().slice(0, 10) : null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateBankTransaction = useMutation({
    mutationFn: async ({
      id,
      applyToSimilar,
      ...fields
    }: {
      id: string;
      line_item_id?: string | null;
      dossier?: string | null;
      applyToSimilar?: boolean;
    }) => {
      const client = supabase as any;
      const { error } = await client.from("bank_transactions").update(fields).eq("id", id);
      if (error) throw error;

      let similarUpdated = 0;
      if (applyToSimilar) {
        const { data: current } = await client
          .from("bank_transactions")
          .select("counterparty")
          .eq("id", id)
          .maybeSingle();
        const counterparty = (current?.counterparty || "").trim();
        if (counterparty) {
          const { data: similar } = await client
            .from("bank_transactions")
            .select("id, line_item_id, dossier")
            .eq("year", year)
            .ilike("counterparty", counterparty)
            .neq("id", id);
          const toUpdate = (similar || []).filter((row: any) => {
            // Alleen overschrijven als nog niet handmatig gekoppeld
            const noLi = !row.line_item_id;
            const noDossier = !row.dossier;
            return noLi && noDossier;
          });
          if (toUpdate.length > 0) {
            const ids = toUpdate.map((r: any) => r.id);
            const { error: bulkErr } = await client
              .from("bank_transactions")
              .update(fields)
              .in("id", ids);
            if (bulkErr) throw bulkErr;
            similarUpdated = ids.length;
          }
        }
      }
      return { similarUpdated };
    },
    onSuccess: invalidate,
  });

  const updatePontoTransaction = useMutation({
    mutationFn: async ({
      id,
      budget_line_item_id,
      dossier,
    }: {
      id: string;
      budget_line_item_id?: string | null;
      dossier?: string | null;
    }) => {
      const client = supabase as any;
      const fields: any = {};
      if (budget_line_item_id !== undefined) fields.budget_line_item_id = budget_line_item_id;
      if (dossier !== undefined) fields.dossier = dossier;
      const { error } = await client.from("ponto_transactions").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const linkPaymentToMember = useMutation({
    mutationFn: async ({
      member_id,
      amount,
      paid_at,
      userId,
    }: {
      member_id: number;
      amount: number;
      paid_at: string | null;
      userId: string;
    }) => {
      const { error } = await (supabase as any).from("contribution_payments").insert({
        member_id,
        year,
        amount,
        status: "paid",
        payment_method: "bank",
        paid_at: paid_at || new Date().toISOString(),
        created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget-categories", year] });
      qc.invalidateQueries({ queryKey: ["contribution-payments"] });
      qc.invalidateQueries({ queryKey: ["contributions"] });
    },
  });

  const addBalanceItem = useMutation({
    mutationFn: async ({ name, amount, section, side = 'right' }: { name: string; amount: number; section: string; side?: string }) => {
      const { data: existing } = await supabase
        .from("budget_balance_items")
        .select("sort_order")
        .eq("year", year)
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;
      const { error } = await supabase.from("budget_balance_items").insert({ year, name, amount, section, side, sort_order: nextOrder });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateBalanceItem = useMutation({
    mutationFn: async ({ id, name, amount }: { id: string; name?: string; amount?: number }) => {
      const updates: any = { updated_at: new Date().toISOString() };
      if (name !== undefined) updates.name = name;
      if (amount !== undefined) updates.amount = amount;
      const { error } = await supabase.from("budget_balance_items").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteBalanceItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_balance_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const addNote = useMutation({
    mutationFn: async ({ note, userId }: { note: string; userId: string }) => {
      const { error } = await supabase.from("budget_notes").insert({ year, note, created_by: userId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget-notes", year] }),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("budget_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget-notes", year] }),
  });

  const replaceBankStatement = useMutation({
    mutationFn: async ({
      fileName,
      openingBalance,
      closingBalance,
      transactions,
      userId,
    }: {
      fileName: string;
      openingBalance: number | null;
      closingBalance: number | null;
      transactions: {
        transaction_date?: string | null;
        direction: "in" | "out";
        counterparty?: string | null;
        description?: string | null;
        invoice_reference?: string | null;
        amount: number;
      }[];
      userId: string;
    }) => {
      const client = supabase as any;
      const { data: oldUploads, error: oldError } = await client
        .from("bank_statement_uploads")
        .select("id")
        .eq("year", year);
      if (oldError) throw oldError;

      const { data: upload, error: uploadError } = await client
        .from("bank_statement_uploads")
        .insert({
          year,
          file_name: fileName,
          opening_balance: openingBalance,
          closing_balance: closingBalance,
          imported_by: userId,
        })
        .select("id")
        .single();
      if (uploadError) throw uploadError;

      const normalize = (value?: string | null) => (value || "").toLowerCase().replace(/\s+/g, " ").trim();
      const rows = transactions.map((t, index) => {
        const amount = Math.abs(Number(t.amount) || 0);
        const rawHash = [
          index,
          t.transaction_date || "",
          t.direction,
          amount.toFixed(2),
          normalize(t.counterparty),
          normalize(t.description),
          normalize(t.invoice_reference),
        ].join("|");
        return {
          upload_id: upload.id,
          year,
          row_index: index,
          transaction_date: t.transaction_date || null,
          direction: t.direction,
          counterparty: t.counterparty || null,
          description: t.description || null,
          invoice_reference: t.invoice_reference || null,
          amount,
          row_hash: rawHash,
        };
      });

      if (rows.length > 0) {
        const { error: txError } = await client.from("bank_transactions").insert(rows);
        if (txError) throw txError;
      }

      const oldIds = (oldUploads || []).map((u: any) => u.id).filter((id: string) => id !== upload.id);
      if (oldIds.length > 0) {
        const { error: deleteError } = await client.from("bank_statement_uploads").delete().in("id", oldIds);
        if (deleteError) throw deleteError;
      }
    },
    onSuccess: invalidate,
  });

  return {
    addCategory,
    addLineItem,
    updateLineItem,
    deleteLineItem,
    deleteCategory,
    addExpense,
    deleteExpense,
    updateExpense,
    toggleExpensePaid,
    addBalanceItem,
    updateBalanceItem,
    deleteBalanceItem,
    addNote,
    deleteNote,
    replaceBankStatement,
    updateBankTransaction,
    updatePontoTransaction,
    linkPaymentToMember,
  };
}

export function useBudgetNotes(year: number) {
  return useQuery({
    queryKey: ["budget-notes", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_notes")
        .select("*")
        .eq("year", year)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; note: string; created_at: string }[];
    },
  });
}

export interface BudgetYearSettings {
  id: string;
  year: number;
  budgeted_member_count: number;
  contribution_amount: number;
  expense_source_preference: ExpenseSourcePreference;
}

export function useBudgetYearSettings(year: number) {
  return useQuery({
    queryKey: ["budget-year-settings", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("budget_year_settings")
        .select("*")
        .eq("year", year)
        .maybeSingle();
      if (error) throw error;
      return data as BudgetYearSettings | null;
    },
  });
}

export function useBudgetYearSettingsMutation(year: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { budgeted_member_count?: number; contribution_amount?: number; expense_source_preference?: ExpenseSourcePreference }) => {
      const { data: existing } = await supabase
        .from("budget_year_settings")
        .select("*")
        .eq("year", year)
        .maybeSingle();
      const merged = {
        budgeted_member_count: input.budgeted_member_count ?? (existing as any)?.budgeted_member_count ?? 0,
        contribution_amount: input.contribution_amount ?? (existing as any)?.contribution_amount ?? 3000,
        expense_source_preference: input.expense_source_preference ?? ((existing as any)?.expense_source_preference === "pdf_import" ? "pdf_import" : "manual"),
      };
      if (existing) {
        const { error } = await supabase.from("budget_year_settings").update({ ...merged, updated_at: new Date().toISOString() }).eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("budget_year_settings").insert({ year, ...merged });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget-year-settings", year] });
      qc.invalidateQueries({ queryKey: ["budget-categories", year] });
    },
  });
}
