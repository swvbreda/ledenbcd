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
