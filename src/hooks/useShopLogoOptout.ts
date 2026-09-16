import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Coffeeshops waarvan het logo NIET publiek op coffeeshopbond.nl getoond mag
 * worden. Standaard staat een logo aan; alleen uitzonderingen staan hier.
 */
export function useShopLogoOptouts(enabled = true) {
  return useQuery({
    queryKey: ["shop-logo-optout"],
    enabled,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase.from("shop_logo_optout").select("register_id");
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.register_id));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetShopLogoOptout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      register_id,
      member_id,
      uitgezet,
    }: {
      register_id: string;
      member_id?: number | null;
      uitgezet: boolean;
    }) => {
      if (uitgezet) {
        const { data: auth } = await supabase.auth.getUser();
        const { error } = await supabase.from("shop_logo_optout").upsert(
          {
            register_id,
            member_id: member_id ?? null,
            uitgezet_door: auth.user?.id ?? null,
          },
          { onConflict: "register_id" },
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("shop_logo_optout")
          .delete()
          .eq("register_id", register_id);
        if (error) throw error;
      }
      return uitgezet;
    },
    onSuccess: (uitgezet) => {
      queryClient.invalidateQueries({ queryKey: ["shop-logo-optout"] });
      toast.success(
        uitgezet
          ? "Logo wordt niet meer publiek getoond (binnen vijf minuten verwerkt)"
          : "Logo wordt weer publiek getoond (binnen vijf minuten verwerkt)",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
