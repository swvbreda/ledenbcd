import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface WhatsAppStatusRow {
  member_id: number;
  in_community: boolean;
  matched_phone: string | null;
  matched_name: string | null;
  last_checked_at: string;
  updated_at: string;
}

export function useWhatsAppStatus() {
  const qc = useQueryClient();
  const { user, isAdmin, isBoard } = useAuth();
  const enabled = !!user && (isAdmin || isBoard);

  const query = useQuery({
    queryKey: ["whatsapp-status"],
    enabled,
    queryFn: async (): Promise<Record<number, WhatsAppStatusRow>> => {
      const { data, error } = await supabase
        .from("member_whatsapp_status")
        .select("*");
      if (error) throw error;
      const map: Record<number, WhatsAppStatusRow> = {};
      for (const row of (data ?? []) as WhatsAppStatusRow[]) {
        map[row.member_id] = row;
      }
      return map;
    },
  });

  const setStatus = useMutation({
    mutationFn: async (input: {
      member_id: number;
      in_community: boolean;
      matched_phone?: string | null;
      matched_name?: string | null;
    }) => {
      const payload = {
        member_id: input.member_id,
        in_community: input.in_community,
        matched_phone: input.matched_phone ?? null,
        matched_name: input.matched_name ?? null,
        last_checked_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      };
      const { error } = await supabase
        .from("member_whatsapp_status")
        .upsert(payload, { onConflict: "member_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
  });

  const bulkSetStatus = useMutation({
    mutationFn: async (
      rows: Array<{
        member_id: number;
        in_community: boolean;
        matched_phone?: string | null;
        matched_name?: string | null;
      }>,
    ) => {
      if (rows.length === 0) return;
      const now = new Date().toISOString();
      const payload = rows.map((r) => ({
        member_id: r.member_id,
        in_community: r.in_community,
        matched_phone: r.matched_phone ?? null,
        matched_name: r.matched_name ?? null,
        last_checked_at: now,
        updated_by: user?.id ?? null,
      }));
      const { error } = await supabase
        .from("member_whatsapp_status")
        .upsert(payload, { onConflict: "member_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-status"] });
    },
  });

  return {
    statusByMember: query.data ?? {},
    isLoading: query.isLoading,
    setStatus,
    bulkSetStatus,
  };
}