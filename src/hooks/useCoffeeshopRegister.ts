import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type RegisterShop = {
  id: string;
  bron_id: string;
  naam: string;
  straat: string | null;
  huisnummer: string | null;
  huisnummer_toevoeging: string | null;
  postcode: string | null;
  plaats: string | null;
  gemeente: string | null;
  provincie: string | null;
  exploitant: string | null;
  vergunninghouder: string | null;
  vergunningnummer: string | null;
  status: string;
  vergunningverlening: string | null;
  einddatum: string | null;
  website: string | null;
  telefoon: string | null;
  vervallen: boolean;
  synced_at: string;
};

export type RegisterUbo = {
  id: string;
  register_id: string;
  niveau: number;
  naam: string;
  kvk_nummer: string | null;
  soort: string;
  betrouwbaarheid: string | null;
  is_uiteindelijk: boolean;
  toelichting: string | null;
};

export type RegisterLink = {
  id: string;
  register_id: string;
  member_id: number;
  match_score: number;
  match_reden: string | null;
  status: "voorstel" | "bevestigd" | "afgewezen";
};

export function useCoffeeshopRegister(enabled = true) {
  return useQuery({
    queryKey: ["coffeeshop-register"],
    enabled,
    queryFn: async (): Promise<RegisterShop[]> => {
      const all: RegisterShop[] = [];
      const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await supabase
          .from("coffeeshop_register")
          .select("*")
          .order("naam")
          .range(from, from + page - 1);
        if (error) throw error;
        all.push(...((data ?? []) as unknown as RegisterShop[]));
        if (!data || data.length < page) break;
      }
      return all;
    },
  });
}

export function useRegisterLinks(enabled = true) {
  return useQuery({
    queryKey: ["coffeeshop-register-links"],
    enabled,
    queryFn: async (): Promise<RegisterLink[]> => {
      const { data, error } = await supabase.from("coffeeshop_member_links").select("*");
      if (error) throw error;
      return (data ?? []) as unknown as RegisterLink[];
    },
  });
}

export function useRegisterUbo(registerId: string | null) {
  return useQuery({
    queryKey: ["coffeeshop-register-ubo", registerId],
    enabled: !!registerId,
    queryFn: async (): Promise<RegisterUbo[]> => {
      const { data, error } = await supabase
        .from("coffeeshop_register_ubo")
        .select("*")
        .eq("register_id", registerId!)
        .order("niveau");
      if (error) throw error;
      return (data ?? []) as unknown as RegisterUbo[];
    },
  });
}

export function useRegisterSyncState(enabled = true) {
  return useQuery({
    queryKey: ["coffeeshop-register-sync-state"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coffeeshop_register_sync_state")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function useSetRegisterLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      register_id: string;
      member_id: number | null;
      status: "bevestigd" | "afgewezen";
      existingId?: string;
    }) => {
      if (input.status === "afgewezen" && input.existingId) {
        const { error } = await supabase
          .from("coffeeshop_member_links")
          .update({ status: "afgewezen" })
          .eq("id", input.existingId);
        if (error) throw error;
        return;
      }
      if (!input.member_id) throw new Error("Kies eerst een lid");
      const { error } = await supabase.from("coffeeshop_member_links").upsert(
        {
          register_id: input.register_id,
          member_id: input.member_id,
          status: input.status,
          match_score: 1,
          match_reden: "Handmatig bevestigd",
          bevestigd_op: new Date().toISOString(),
        },
        { onConflict: "register_id,member_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coffeeshop-register-links"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Koppelen mislukt"),
  });
}

export function useSyncRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("trigger_coffeeshopregister_sync" as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Synchronisatie gestart — dit duurt even");
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["coffeeshop-register"] });
        qc.invalidateQueries({ queryKey: ["coffeeshop-register-links"] });
        qc.invalidateQueries({ queryKey: ["coffeeshop-register-sync-state"] });
      }, 12000);
    },
    onError: (e: any) => toast.error(e.message ?? "Synchronisatie mislukt"),
  });
}

export type EnrichmentProposal = {
  id: string;
  member_id: number;
  register_id: string | null;
  scope: string;
  location_key: string | null;
  field: string;
  current_value: string | null;
  proposed_value: string;
  source: string;
  status: "open" | "toegepast" | "genegeerd";
  created_at: string;
};

export function useEnrichmentProposals(enabled = true) {
  return useQuery({
    queryKey: ["register-enrichment-proposals"],
    enabled,
    queryFn: async (): Promise<EnrichmentProposal[]> => {
      const { data, error } = await supabase
        .from("register_enrichment_proposals" as any)
        .select("*")
        .eq("status", "open")
        .order("member_id");
      if (error) throw error;
      return (data ?? []) as unknown as EnrichmentProposal[];
    },
  });
}

/** Neemt een voorstel over in de ledendata (fetch-and-merge) of negeert het. */
export function useResolveProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { proposal: EnrichmentProposal; apply: boolean }) => {
      const { proposal, apply } = input;

      if (apply) {
        const { data: row, error } = await supabase
          .from("members_data")
          .select("id, data")
          .eq("id", proposal.member_id)
          .maybeSingle();
        if (error) throw error;
        if (!row) throw new Error("Lid niet gevonden");

        const data: any = JSON.parse(JSON.stringify((row as any).data ?? {}));
        if (proposal.scope === "locatie") {
          const key = (proposal.location_key ?? "").toUpperCase();
          const locaties: any[] = Array.isArray(data.locaties) ? data.locaties : [];
          const match =
            locaties.find(
              (l) => String(l?.postcode ?? "").toUpperCase().replace(/\s+/g, "") === key,
            ) ??
            locaties.find(
              (l) =>
                String(l?.naam ?? "")
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, " ")
                  .trim() === (proposal.location_key ?? ""),
            );
          if (!match) throw new Error("Locatie niet gevonden bij dit lid");
          match[proposal.field] = proposal.proposed_value;
          data.locaties = locaties;
        } else {
          data[proposal.field] = proposal.proposed_value;
        }

        const { error: upErr } = await supabase
          .from("members_data")
          .update({ data })
          .eq("id", proposal.member_id);
        if (upErr) throw upErr;
      }

      const { error: statusErr } = await supabase
        .from("register_enrichment_proposals" as any)
        .update({
          status: apply ? "toegepast" : "genegeerd",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", proposal.id);
      if (statusErr) throw statusErr;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.apply ? "Overgenomen" : "Genegeerd");
      qc.invalidateQueries({ queryKey: ["register-enrichment-proposals"] });
      qc.invalidateQueries({ queryKey: ["members-data"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Bijwerken mislukt"),
  });
}

export function useRunEnrichment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("trigger_register_enrichment" as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aanvullen gestart — dit duurt even");
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["register-enrichment-proposals"] });
        qc.invalidateQueries({ queryKey: ["members-data"] });
      }, 10000);
    },
    onError: (e: any) => toast.error(e.message ?? "Aanvullen mislukt"),
  });
}
