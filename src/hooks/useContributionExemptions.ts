import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ContributionExemption {
  id: string;
  member_id: number;
  year: number;
  reason: string;
  source: string;
  created_at: string;
}

/** Alle contributievrijstellingen voor een contributiejaar (jaargebonden, niet permanent). */
export function useContributionExemptions(year?: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["contribution-exemptions", year, user?.id],
    enabled: !!user,
    queryFn: async () => {
      let q = (supabase as any).from("contribution_exemptions").select("*");
      if (year) q = q.eq("year", year);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ContributionExemption[];
    },
  });
}

/** Vrijstelling van één lid voor één contributiejaar (bijv. het eigen ledenportaal). */
export function useMemberExemption(memberId: number | null | undefined, year: number) {
  return useQuery({
    queryKey: ["contribution-exemption", memberId, year],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("contribution_exemptions")
        .select("*")
        .eq("member_id", memberId!)
        .eq("year", year)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ContributionExemption | null;
    },
  });
}
