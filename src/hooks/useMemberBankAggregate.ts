import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BankAggregateRow } from "@/lib/representationSummary";
import { bankGroupsFromAggregate } from "@/lib/memberBankAggregate";

/** Beveiligd ledenaggregaat: alleen aantallen per bank, nooit rekeningnummers. */
export function useMemberBankAggregate(enabled: boolean) {
  return useQuery({
    queryKey: ["member-bank-aggregate"],
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_member_bank_aggregate");
      if (error) throw error;
      return bankGroupsFromAggregate((data ?? []) as BankAggregateRow[]);
    },
  });
}
