import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { aggregateByGemeente } from "@/data/gemeenteMapping";
import coffeeshopData from "@/data/coffeeshops-nl.json";

const fallbackPerGemeente = aggregateByGemeente(coffeeshopData.perStad as Record<string, number>);
const fallbackTotal = coffeeshopData.totaalNL as number;

export type RegisterStats = {
  perGemeente: Record<string, number>;
  totaalNL: number;
  /** true wanneer de cijfers rechtstreeks uit het coffeeshopregister komen */
  fromRegister: boolean;
};

/** Actuele, geverifieerde cijfers uit Coffeeshopbeleid (statisch bestand alleen als noodfallback). */
export function useRegisterStats() {
  const query = useQuery({
    queryKey: ["register-plaats-stats"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RegisterStats> => {
      const { data, error } = await supabase.rpc("get_register_plaats_stats" as any);
      if (error) throw error;
      const rows = (data ?? []) as { plaats: string; aantal: number }[];
      if (!rows.length) return { perGemeente: fallbackPerGemeente, totaalNL: fallbackTotal, fromRegister: false };
      const perPlaats: Record<string, number> = {};
      for (const r of rows) {
        if (!r.plaats) continue;
        perPlaats[r.plaats] = (perPlaats[r.plaats] || 0) + Number(r.aantal || 0);
      }
      const perGemeente = aggregateByGemeente(perPlaats);
      const totaalNL = Object.values(perGemeente).reduce((s, n) => s + n, 0);
      return { perGemeente, totaalNL, fromRegister: true };
    },
  });

  return {
    ...query,
    perGemeente: query.data?.perGemeente ?? fallbackPerGemeente,
    totaalNL: query.data?.totaalNL ?? fallbackTotal,
    fromRegister: query.data?.fromRegister ?? false,
  };
}

export type RegisterLinkSummary = {
  actieve_shops: number;
  bevestigde_koppelingen: number;
  gekoppelde_leden: number;
  vervallen_koppelingen: number;
};

export function useRegisterLinkSummary() {
  return useQuery({
    queryKey: ["register-link-summary"],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<RegisterLinkSummary> => {
      const { data, error } = await supabase.rpc("get_register_link_summary" as any);
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as RegisterLinkSummary | undefined;
      return (
        row ?? { actieve_shops: 0, bevestigde_koppelingen: 0, gekoppelde_leden: 0, vervallen_koppelingen: 0 }
      );
    },
  });
}
