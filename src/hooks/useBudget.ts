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
  created_at: string;
}

export interface BudgetBalanceItem {
  id: string;
  year: number;
  name: string;
  amount: number;
  section: string;
  sort_order: number;
}

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

      const lineItemIds = (lineItems || []).map((li: any) => li.id);
      let expenses: any[] = [];
      if (lineItemIds.length > 0) {
        const { data: exp, error: expError } = await supabase
          .from("budget_expenses")
          .select("*")
          .in("line_item_id", lineItemIds);
        if (expError) throw expError;
        expenses = exp || [];
      }

      const expensesByLineItem: Record<string, any[]> = {};
      for (const e of expenses) {
        if (!expensesByLineItem[e.line_item_id]) expensesByLineItem[e.line_item_id] = [];
        expensesByLineItem[e.line_item_id].push(e);
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

export function useBudgetMutations(year: number) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["budget-categories", year] });
    qc.invalidateQueries({ queryKey: ["budget-balance", year] });
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
    mutationFn: async (expense: { line_item_id: string; description?: string; amount: number; expense_date?: string; creditor_name?: string; invoice_reference?: string; dossier?: string; created_by: string }) => {
      const { error } = await supabase.from("budget_expenses").insert(expense);
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

  const addBalanceItem = useMutation({
    mutationFn: async ({ name, amount, section }: { name: string; amount: number; section: string }) => {
      const { data: existing } = await supabase
        .from("budget_balance_items")
        .select("sort_order")
        .eq("year", year)
        .order("sort_order", { ascending: false })
        .limit(1);
      const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;
      const { error } = await supabase.from("budget_balance_items").insert({ year, name, amount, section, sort_order: nextOrder });
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

  return {
    addCategory,
    addLineItem,
    updateLineItem,
    deleteLineItem,
    deleteCategory,
    addExpense,
    deleteExpense,
    addBalanceItem,
    updateBalanceItem,
    deleteBalanceItem,
    addNote,
    deleteNote,
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
