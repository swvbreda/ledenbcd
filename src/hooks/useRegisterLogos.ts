import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type RegisterLogo = {
  member_id: number;
  location_key: string | null;
  logo_url: string;
};

/**
 * Logo's van gekoppelde coffeeshops uit het register. De database geeft hier
 * alleen het logo terug (geen andere registergegevens), zodat ook gewone leden
 * de logo's te zien krijgen zonder iets over koppelingen te weten.
 */
export function useRegisterLogos() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["member-register-logos"],
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_member_register_logos");
      if (error) throw error;
      const rows = (data ?? []) as RegisterLogo[];
      const byMember = new Map<number, string>();
      const byLocation = new Map<string, string>();
      for (const row of rows) {
        if (!row.logo_url) continue;
        if (!byMember.has(row.member_id)) byMember.set(row.member_id, row.logo_url);
        if (row.location_key) byLocation.set(row.location_key, row.logo_url);
      }
      return { rows, byMember, byLocation };
    },
  });
}
