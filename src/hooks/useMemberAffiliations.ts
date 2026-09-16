import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type MemberAffiliation = {
  id: string;
  member_id: number;
  related_member_id: number;
  notitie: string | null;
};

/** Alle gelieerde leden (zelfde eigenaren of zelfde pand, aparte lidmaatschappen). */
export function useMemberAffiliations() {
  return useQuery({
    queryKey: ["member-affiliations"],
    queryFn: async (): Promise<MemberAffiliation[]> => {
      const { data, error } = await supabase
        .from("member_affiliations")
        .select("id, member_id, related_member_id, notitie");
      if (error) throw error;
      return (data ?? []) as MemberAffiliation[];
    },
  });
}

/** Legt twee leden als gelieerd vast; altijd in beide richtingen. */
export function useSetAffiliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { memberIds: number[]; notitie?: string }) => {
      const ids = Array.from(new Set(input.memberIds));
      const rows: Array<{ member_id: number; related_member_id: number; notitie: string | null }> = [];
      for (const a of ids) {
        for (const b of ids) {
          if (a === b) continue;
          rows.push({ member_id: a, related_member_id: b, notitie: input.notitie ?? null });
        }
      }
      if (!rows.length) return;
      const { error } = await supabase
        .from("member_affiliations")
        .upsert(rows, { onConflict: "member_id,related_member_id", ignoreDuplicates: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Als gelieerde leden vastgelegd");
      qc.invalidateQueries({ queryKey: ["member-affiliations"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Vastleggen mislukt"),
  });
}

export function useRemoveAffiliation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { memberIds: number[] }) => {
      const ids = input.memberIds;
      const { error } = await supabase
        .from("member_affiliations")
        .delete()
        .in("member_id", ids)
        .in("related_member_id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Koppeling als gelieerd verwijderd");
      qc.invalidateQueries({ queryKey: ["member-affiliations"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Verwijderen mislukt"),
  });
}
