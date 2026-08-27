import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InternalDeclaration {
  id: string;
  year: number;
  board_member_name: string;
  declaration_type: string;
  appointment: string | null;
  trajectory: string | null;
  km_single: number | null;
  km_return: number | null;
  km_rate: number;
  amount: number;
  expense_date: string | null;
  bank_account: string | null;
  account_holder: string | null;
  max_allowance_note: string | null;
  status: string;
  submitted_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  bank_transaction_id: string | null;
}

export function useInternalDeclarations(year: number) {
  return useQuery({
    queryKey: ["internal-declarations", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_declarations")
        .select("*")
        .eq("year", year)
        .order("expense_date", { ascending: true });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        km_single: d.km_single ? Number(d.km_single) : null,
        km_return: d.km_return ? Number(d.km_return) : null,
        km_rate: Number(d.km_rate),
        amount: Number(d.amount),
      })) as InternalDeclaration[];
    },
  });
}

export function useInternalDeclarationMutations(year: number) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["internal-declarations", year] });

  const add = useMutation({
    mutationFn: async (decl: Omit<InternalDeclaration, "id" | "reviewed_by" | "reviewed_at">) => {
      const { error } = await supabase.from("internal_declarations").insert(decl as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string } & Partial<Omit<InternalDeclaration, "id">>) => {
      const { error } = await supabase.from("internal_declarations").update(fields as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("internal_declarations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });


  const approve = useMutation({
    mutationFn: async ({ id, reviewerId }: { id: string; reviewerId: string }) => {
      const { error } = await supabase
        .from("internal_declarations")
        .update({ status: "approved", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: async ({ id, reviewerId }: { id: string; reviewerId: string }) => {
      const { error } = await supabase
        .from("internal_declarations")
        .update({ status: "rejected", reviewed_by: reviewerId, reviewed_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, remove, approve, reject };
}
