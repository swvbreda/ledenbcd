import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ContributionInvoice {
  id: string;
  member_id: number;
  year: number;
  invoice_number: string | null;
  invoice_file_path: string | null;
  amount: number | null;
  invoice_date: string | null;
  created_at: string;
}

export interface ContributionPayment {
  id: string;
  member_id: number;
  year: number;
  amount: number;
  status: string;
  payment_method: string;
  paid_at: string | null;
  created_at: string;
}

export interface Contribution {
  id: string;
  member_id: number;
  year: number;
  amount: number;
  paid: boolean;
  paid_date: string | null;
  notes: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  invoice_file_path: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export function useContributions(year?: number) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["contributions", year, user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) throw new Error("Niet ingelogd");
      let q = supabase.from("member_contributions").select("*");
      if (year) q = q.eq("year", year);
      const { data, error } = await q.order("member_id");
      if (error) throw error;
      return (data ?? []) as Contribution[];
    },
  });

  return query;
}

export function useMemberContributions(memberId: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contributions", "member", memberId, user?.id],
    enabled: !!user && !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_contributions")
        .select("*")
        .eq("member_id", memberId)
        .order("year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Contribution[];
    },
  });
}

export function useUpsertContribution() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      member_id: number;
      year: number;
      amount: number;
      paid: boolean;
      paid_date?: string | null;
      notes?: string | null;
    }) => {
      if (!user) throw new Error("Niet ingelogd");
      const { data, error } = await supabase
        .from("member_contributions")
        .upsert(
          {
            member_id: input.member_id,
            year: input.year,
            amount: input.amount,
            paid: input.paid,
            paid_date: input.paid_date ?? null,
            notes: input.notes ?? null,
            created_by: user.id,
          },
          { onConflict: "member_id,year" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contributions"] });
    },
  });
}

export function useContributionInvoices(year?: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contribution-invoices", year, user?.id],
    enabled: !!user,
    queryFn: async () => {
      let q = (supabase as any).from("contribution_invoices").select("*");
      if (year) q = q.eq("year", year);
      const { data, error } = await q.order("member_id");
      if (error) throw error;
      return (data ?? []) as ContributionInvoice[];
    },
  });
}

export function useContributionPayments(year?: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contribution-payments", year, user?.id],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("contribution_payments").select("*").eq("status", "paid");
      if (year) q = q.eq("year", year);
      const { data, error } = await q.order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({ ...p, amount: Number(p.amount) || 0 })) as ContributionPayment[];
    },
  });
}

export function useCreateContributionInvoice() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      member_id: number;
      year: number;
      invoice_number?: string | null;
      invoice_file_path?: string | null;
      amount?: number | null;
      invoice_date?: string | null;
    }) => {
      const { data, error } = await (supabase as any)
        .from("contribution_invoices")
        .insert({
          member_id: input.member_id,
          year: input.year,
          invoice_number: input.invoice_number ?? null,
          invoice_file_path: input.invoice_file_path ?? null,
          amount: input.amount ?? null,
          invoice_date: input.invoice_date ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as ContributionInvoice;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contribution-invoices"] });
    },
  });
}

export function useMemberInvoices(memberId: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contribution-invoices", "member", memberId, user?.id],
    enabled: !!user && !!memberId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contribution_invoices")
        .select("*")
        .eq("member_id", memberId)
        .order("year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContributionInvoice[];
    },
  });
}

export function useMemberPayments(memberId: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contribution-payments", "member", memberId, user?.id],
    enabled: !!user && !!memberId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contribution_payments")
        .select("id,member_id,year,amount,status,payment_method,paid_at,created_at")
        .eq("member_id", memberId)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContributionPayment[];
    },
  });
}

