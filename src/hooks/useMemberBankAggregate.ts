import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  bankGroupsFromAggregate,
  pspGroupsFromAggregate,
  type BankGroupRow,
  type PspGroupRow,
} from "@/lib/memberBankAggregate";

/** Beveiligd ledenaggregaat: alleen banknaam/categorie met aantallen, nooit rekeningnummers. */
export function useMemberBankAggregate(enabled: boolean) {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  return useQuery({
    queryKey: ["member-bank-groups", uid],
    enabled: enabled && !!uid,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_member_bank_groups");
      if (error) throw error;
      return bankGroupsFromAggregate((data ?? []) as BankGroupRow[]);
    },
  });
}

/** Beveiligd ledenaggregaat betaalverwerkers: alleen aanbieder/"Anders", aantal vestigingen en pct. */
export function useMemberPspAggregate(enabled: boolean) {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  return useQuery({
    queryKey: ["member-psp-groups", uid],
    enabled: enabled && !!uid,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_member_psp_groups");
      if (error) throw error;
      return pspGroupsFromAggregate((data ?? []) as PspGroupRow[]);
    },
  });
}
