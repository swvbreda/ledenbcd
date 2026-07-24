import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1] && match?.[2]) {
      return `${match[1]}-${match[2]}`;
    }
  }

  return null;
};

export function useBudgetCategories(year: number, sourcePreference: ExpenseSourcePreference = "manual") {
  return useQuery({
    queryKey: ["budget-categories", year, sourcePreference],
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

      const lineItemIds = (lineItems || []).map((li: any) => li.id);
      let expenses: any[] = [];
      if (lineItemIds.length > 0) {
        const { data: exp, error: expError } = await supabase
          .from("budget_expenses")
          .select("*")
          .in("line_item_id", lineItemIds)
          .eq("direction", "out")
          .eq("source", sourcePreference);
        if (expError) throw expError;
        expenses = exp || [];
      }

      // Inkomende/uitgaande banktransacties die handmatig aan een begrotingspost
      // zijn gekoppeld tellen óók mee in het budget. Inkomend = refund/storting
      // → wordt straks afgetrokken van het bestede bedrag.
      let bankAsExpenses: any[] = [];
      if (lineItemIds.length > 0) {
        const client = supabase as any;
        const { data: bankRows, error: bankErr } = await client
          .from("bank_transactions")
          .select("*")
          .eq("year", year)
          .in("line_item_id", lineItemIds);
        if (bankErr) throw bankErr;
        bankAsExpenses = (bankRows || []).map((b: any) => {
          const invoiceReference = extractInvoiceReference(b.invoice_reference, b.description) || b.invoice_reference;
          return {
            id: `bank:${b.id}`,
            line_item_id: b.line_item_id,
            description: b.description,
            amount: Number(b.amount) || 0,
            expense_date: b.transaction_date,
            creditor_name: b.counterparty,
            invoice_reference: invoiceReference,
            dossier: b.dossier,
            source: "bank",
            pdf_file_path: null,
            paid: true,
            paid_date: b.transaction_date,
            created_at: b.created_at,
            direction: b.direction,
            _fromBank: true,
          };
        });

        // Live bankboekingen (Ponto): koppel via budget_line_item_id
        const yearStart = `${year}-01-01`;
        const yearEnd = `${year + 1}-01-01`;
        const { data: pontoRows, error: pontoErr } = await client
          .from("ponto_transactions")
          .select("id, executed_at, amount, counterparty_name, description, remittance_info, budget_line_item_id, dossier, created_at")
          .in("budget_line_item_id", lineItemIds)
          .gte("executed_at", yearStart)
          .lt("executed_at", yearEnd);
        if (pontoErr) throw pontoErr;
        const pontoAsExpenses = (pontoRows || []).map((p: any) => {
          const raw = Number(p.amount) || 0;
          const invoiceReference = extractInvoiceReference(p.description, p.remittance_info);
          return {
            id: `ponto:${p.id}`,
            line_item_id: p.budget_line_item_id,
            description: p.description || p.remittance_info,
            amount: Math.abs(raw),
            expense_date: p.executed_at,
            creditor_name: p.counterparty_name,
            invoice_reference: invoiceReference,
            dossier: p.dossier,
            source: "bank",
            pdf_file_path: null,
            paid: true,
            paid_date: p.executed_at,
            created_at: p.created_at,
            direction: raw >= 0 ? "in" : "out",
            _fromBank: true,
          };
        });
        bankAsExpenses = bankAsExpenses.concat(pontoAsExpenses);
      }

      // Dedupliceer bankregels: ABN-import (bank_transactions) en Ponto
      // (ponto_transactions) kunnen dezelfde betaling bevatten, soms met een
      // dagverschil (executed_at vs booking date) en verschillende opmaak. We
      // matchen daarom primair op factuurnummer + bedrag, en pas als er geen
      // factuurnummer is op datum(±2) + bedrag + tegenpartij. Voorkeur: Ponto.
      {
        const isPonto = (e: any) => String(e.id).startsWith("ponto:");
        // Sorteer zodat Ponto-regels eerst worden gezien en behouden blijven.
        const sorted = [...bankAsExpenses].sort((a, b) => (isPonto(b) ? 1 : 0) - (isPonto(a) ? 1 : 0));
        const kept: any[] = [];
        const invSeen = new Map<string, any>();
        const dateSeen: { key: string; day: number; entry: any }[] = [];
        for (const e of sorted) {
          const amtKey = Math.round((Number(e.amount) || 0) * 100);
          const invKey = normalizeInvoiceKey(extractInvoiceReference(e.invoice_reference, e.description) || e.invoice_reference);
          const directionKey = e.direction || "out";
          if (invKey) {
            const key = `${e.line_item_id}|${directionKey}|${amtKey}|${invKey}`;
            if (invSeen.has(key)) continue;
            invSeen.set(key, e);
            kept.push(e);
            continue;
          }
          const cpKey = normalizePartyKey(e.creditor_name || e.description);
          const baseKey = `${e.line_item_id}|${directionKey}|${amtKey}|${cpKey}`;
          const day = dayNumber(e.expense_date);
          const dup = dateSeen.find((d) => d.key === baseKey && Math.abs(d.day - day) <= 4);
          if (dup) continue;
          dateSeen.push({ key: baseKey, day, entry: e });
          kept.push(e);
        }
        bankAsExpenses = kept;
      }

      // Dedupliceer handmatige/PDF-boekingen tegen bankregels: als er een
      // bankboeking bestaat met hetzelfde factuurnummer + bedrag (of dezelfde
      // dag±2 + bedrag + creditor) op dezelfde post, laten we de handmatige
      // versie vallen zodat we niet dubbel tellen.
      {
        const bankInv = new Set<string>();
        const bankDate: { key: string; day: number }[] = [];
        for (const b of bankAsExpenses) {
          const amtKey = Math.round((Number(b.amount) || 0) * 100);
          const invKey = normalizeInvoiceKey(extractInvoiceReference(b.invoice_reference, b.description) || b.invoice_reference);
          const directionKey = b.direction || "out";
          if (invKey) bankInv.add(`${b.line_item_id}|${directionKey}|${amtKey}|${invKey}`);
          bankDate.push({
            key: `${b.line_item_id}|${directionKey}|${amtKey}|${normalizePartyKey(b.creditor_name || b.description)}`,
            day: dayNumber(b.expense_date),
          });
        }
        expenses = expenses.filter((e: any) => {
          const amtKey = Math.round((Number(e.amount) || 0) * 100);
          const invKey = normalizeInvoiceKey(extractInvoiceReference(e.invoice_reference, e.description) || e.invoice_reference);
          const directionKey = e.direction || "out";
          if (invKey && bankInv.has(`${e.line_item_id}|${directionKey}|${amtKey}|${invKey}`)) return false;
          const baseKey = `${e.line_item_id}|${directionKey}|${amtKey}|${normalizePartyKey(e.creditor_name || e.description)}`;
          const day = dayNumber(e.expense_date);
          if (bankDate.some((d) => d.key === baseKey && Math.abs(d.day - day) <= 4)) return false;
          return true;
        });
      }

      // Voor de post "Contributies" (Inkomsten) zijn geregistreerde betalingen
      // leidend: de bankbijschrijvingen en verrekeningen komen hierin samen.
      const contribCategory = (categories || []).find(
        (c: any) => String(c.name).toLowerCase() === "inkomsten"
      );
      const contribLineItem = contribCategory
        ? (lineItems || []).find(
            (li: any) =>
              li.category_id === contribCategory.id &&
              String(li.name).toLowerCase().startsWith("contribut"),
          )
        : null;
      if (contribLineItem) {
        const { data: paidContribs, error: pcErr } = await (supabase as any)
          .from("contribution_payments")
          .select("id, member_id, amount, paid_at, updated_at")
          .eq("year", year)
          .eq("status", "paid");
        if (pcErr) throw pcErr;
        const contribAsExpenses = (paidContribs || []).map((c: any) => ({
          id: `contrib:${c.id}`,
          line_item_id: contribLineItem.id,
          description: `Contributie lid #${c.member_id}`,
          amount: Number(c.amount) || 0,
          expense_date: c.paid_at || c.updated_at,
          creditor_name: null,
          invoice_reference: null,
          dossier: null,
          source: "contribution",
          pdf_file_path: null,
          paid: true,
          paid_date: c.paid_at,
          created_at: c.updated_at,
          direction: "in" as const,
          _fromBank: true,
        }));
        // Vervang eventuele ponto-koppelingen op deze post: contributies zijn
        // hier de bron van waarheid — we willen niet dubbel tellen.
        bankAsExpenses = bankAsExpenses.filter(
          (e) => e.line_item_id !== contribLineItem.id,
        );
        bankAsExpenses = bankAsExpenses.concat(contribAsExpenses);
      }

      // Bank is leidend: per begrotingspost gebruiken we de gekoppelde
      // banktransacties als die er zijn. Alleen wanneer er geen enkele bankregel
      // aan een post hangt, vallen we terug op handmatige / PDF-boekingen.
      // Zo voorkomen we dat dezelfde betaling dubbel meetelt (handmatig + bank).
      const bankByLineItem: Record<string, any[]> = {};
      for (const e of bankAsExpenses) {
        if (!bankByLineItem[e.line_item_id]) bankByLineItem[e.line_item_id] = [];
        bankByLineItem[e.line_item_id].push(e);
      }
      const manualByLineItem: Record<string, any[]> = {};
      for (const e of expenses) {
        if (!manualByLineItem[e.line_item_id]) manualByLineItem[e.line_item_id] = [];
        manualByLineItem[e.line_item_id].push(e);
      }
      const expensesByLineItem: Record<string, any[]> = {};
      for (const liId of new Set([...Object.keys(bankByLineItem), ...Object.keys(manualByLineItem)])) {
        expensesByLineItem[liId] = bankByLineItem[liId]?.length
          ? bankByLineItem[liId]
          : (manualByLineItem[liId] || []);
      }

      const lineItemsByCategory: Record<string, any[]> = {};
      for (const li of lineItems || []) {
        if (!lineItemsByCategory[li.category_id]) lineItemsByCategory[li.category_id] = [];
        lineItemsByCategory[li.category_id].push({
          ...li,
          budgeted_amount: Number(li.budgeted_amount),
          expenses: (expensesByLineItem[li.id] || []).map((e: any) => ({ ...e, amount: Number(e.amount) })),
        });
      }

      return (categories || []).map((c: any) => ({
        ...c,
        line_items: lineItemsByCategory[c.id] || [],
      })) as BudgetCategory[];
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
