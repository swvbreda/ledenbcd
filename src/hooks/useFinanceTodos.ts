import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface FinanceTodo {
  id: string;
  todo_type: string;
  title: string;
  description: string | null;
  notes: string | null;
  notes_by: string | null;
  assigned_to: string;
  member_id: number | null;
  reference_id: string | null;
  status: string;
  due_date: string | null;
  year: number;
  created_at: string;
  completed_at: string | null;
}

export function useFinanceTodos(year: number) {
  return useQuery({
    queryKey: ["finance-todos", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_todos")
        .select("*")
        .eq("year", year)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FinanceTodo[];
    },
  });
}

export function useFinanceTodoMutations(year: number) {
  const qc = useQueryClient();
  const key = ["finance-todos", year];

  const complete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("finance_todos")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("finance_todos")
        .update({ status: "dismissed", completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const hold = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("finance_todos")
        .update({ status: "on_hold" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const reopen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("finance_todos")
        .update({ status: "pending", completed_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const addTodo = useMutation({
    mutationFn: async (todo: {
      title: string;
      description?: string;
      assigned_to: string;
      due_date?: string | null;
    }) => {
      const { error } = await supabase
        .from("finance_todos")
        .insert({
          ...todo,
          todo_type: "manual",
          year,
          status: "pending",
        });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const updateNotes = useMutation({
    mutationFn: async ({ id, notes, notes_by }: { id: string; notes: string; notes_by: string }) => {
      const { error } = await supabase
        .from("finance_todos")
        .update({ notes, notes_by })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return { complete, dismiss, hold, reopen, addTodo, updateNotes };
}
