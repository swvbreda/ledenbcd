import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { aggregateByGemeente } from "@/data/gemeenteMapping";
import coffeeshopData from "@/data/coffeeshops-nl.json";

const fallbackPerGemeente = aggregateByGemeente(coffeeshopData.perStad as Record<string, number>);
const fallbackTotal = coffeeshopData.totaalNL as number;

export type RegisterStats = {
  perGemeente: Record<string, number>;
  totaalNL: number;
  representedPerGemeente: Record<string, number>;
  totaalRepresented: number;
  gekoppeldeRegistershops: number;
  nietGekoppeldeLocaties: number;
  koppelingenZonderVestiging: number;
  /** true wanneer de cijfers rechtstreeks uit het coffeeshopregister komen */
  fromRegister: boolean;
};

/** Actuele, geverifieerde cijfers uit Coffeeshopbeleid (statisch bestand alleen als noodfallback). */
export function useRegisterStats() {
  const query = useQuery({
    queryKey: ["register-plaats-stats"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<RegisterStats> => {
      const { data, error } = await supabase.functions.invoke("public-stats", { method: "GET" });
      if (error) throw error;
      const payload = (data ?? {}) as Record<string, unknown>;
      const perPlaats = (payload.landelijk_per_gemeente ?? {}) as Record<string, number>;
      const representedPerPlaats = (payload.vertegenwoordiging_per_gemeente ?? {}) as Record<string, number>;
      if (!Object.keys(perPlaats).length) {
        return {
          perGemeente: fallbackPerGemeente,
          totaalNL: fallbackTotal,
          representedPerGemeente: {},
          totaalRepresented: 0,
          gekoppeldeRegistershops: 0,
          nietGekoppeldeLocaties: 0,
          koppelingenZonderVestiging: 0,
          fromRegister: false,
        };
      }
      const perGemeente = aggregateByGemeente(perPlaats);
      const representedPerGemeente = aggregateByGemeente(representedPerPlaats);
      return {
        perGemeente,
        totaalNL: Number(payload.aantal_landelijk ?? 0),
        representedPerGemeente,
        totaalRepresented: Number(payload.aantal_coffeeshops ?? 0),
        gekoppeldeRegistershops: Number(payload.gekoppelde_registershops ?? 0),
        nietGekoppeldeLocaties: Number(payload.niet_gekoppelde_locaties ?? 0),
        koppelingenZonderVestiging: Number(payload.koppelingen_zonder_vestiging ?? 0),
        fromRegister: true,
      };
    },
  });

  return {
    ...query,
    perGemeente: query.data?.perGemeente ?? fallbackPerGemeente,
    totaalNL: query.data?.totaalNL ?? fallbackTotal,
    representedPerGemeente: query.data?.representedPerGemeente ?? {},
    totaalRepresented: query.data?.totaalRepresented ?? 0,
    gekoppeldeRegistershops: query.data?.gekoppeldeRegistershops ?? 0,
    nietGekoppeldeLocaties: query.data?.nietGekoppeldeLocaties ?? 0,
    koppelingenZonderVestiging: query.data?.koppelingenZonderVestiging ?? 0,
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
