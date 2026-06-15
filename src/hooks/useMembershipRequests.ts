import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MembershipRequest {
  id: string;
  full_name: string;
  email: string;
  coffeeshop_name: string;
  city: string;
  phone: string | null;
  message: string | null;
  status: string;
  created_at: string;
}

export function useMembershipRequests(filter: "pending" | "all" = "pending") {
  return useQuery({
    queryKey: ["membership_requests", filter],
    queryFn: async () => {
      let q = supabase.from("membership_requests").select("*").order("created_at", { ascending: false });
      if (filter === "pending") q = q.eq("status", "new");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MembershipRequest[];
    },
  });
}

export function useUpdateMembershipRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("membership_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membership_requests"] });
    },
  });
}