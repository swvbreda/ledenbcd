import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { allMembersAndLeads } from "@/hooks/useMembers";
import { useAuth } from "@/hooks/useAuth";
import type { Member } from "@/data/types";

interface MemberEdit {
  member_id: number;
  data: Partial<Member>;
}

export function useMemberEdits() {
  return useQuery({
    queryKey: ["member-edits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_edits")
        .select("member_id, data");
      if (error) throw error;
      const map = new Map<number, Partial<Member>>();
      for (const row of data || []) {
        map.set(row.member_id, row.data as Partial<Member>);
      }
      return map;
    },
  });
}

/** Fetch the latest pending edit request for a specific member submitted by the current user */
function useOwnPendingEdit(memberId: number) {
  const { user, isAdmin } = useAuth();
  return useQuery({
    queryKey: ["own-pending-edit", memberId],
    enabled: !!user && !isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_edit_requests")
        .select("data")
        .eq("member_id", memberId)
        .eq("submitted_by", user!.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.data as Partial<Member> | null;
    },
  });
}

export function useMergedMember(memberId: number): { member: Member | undefined; isLoading: boolean } {
  const { data: editsMap, isLoading: editsLoading } = useMemberEdits();
  const { data: pendingEdit, isLoading: pendingLoading } = useOwnPendingEdit(memberId);
  const baseMember = allMembersAndLeads.find((m) => m.id === memberId);

  const isLoading = editsLoading || pendingLoading;

  if (!baseMember) return { member: undefined, isLoading };

  // Start with base, apply approved edits, then overlay pending edit for own profile
  const edits = editsMap?.get(memberId);
  let merged: Member = baseMember;

  if (edits) {
    merged = {
      ...merged,
      ...edits,
      locaties: edits.locaties || merged.locaties,
      contacten: edits.contacten || merged.contacten,
    };
  }

  if (pendingEdit) {
    merged = {
      ...merged,
      ...pendingEdit,
      locaties: pendingEdit.locaties || merged.locaties,
      contacten: pendingEdit.contacten || merged.contacten,
    };
  }

  return { member: merged, isLoading };
}

/** Apply all edits to an array of members */
export function useMergedMembers(members: Member[]): { members: Member[]; isLoading: boolean } {
  const { data: editsMap, isLoading } = useMemberEdits();

  const merged = useMemo(() => {
    if (!editsMap || editsMap.size === 0) return members;
    return members.map((m) => {
      const edits = editsMap.get(m.id);
      if (!edits) return m;
      return {
        ...m,
        ...edits,
        locaties: edits.locaties || m.locaties,
        contacten: edits.contacten || m.contacten,
      };
    });
  }, [members, editsMap]);

  return { members: merged, isLoading };
}

/** Admin: save directly to member_edits (approved immediately) */
export function useSaveMemberEdit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ member_id, data }: MemberEdit) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error("Niet ingelogd");

      const { error } = await supabase
        .from("member_edits")
        .upsert(
          {
            member_id,
            data: data as any,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "member_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-edits"] });
    },
  });
}

/** Member: submit edit request that needs admin approval */
export function useSubmitEditRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ member_id, data }: MemberEdit) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error("Niet ingelogd");

      const { error } = await supabase
        .from("member_edit_requests")
        .insert({
          member_id,
          data: data as any,
          submitted_by: userId,
        });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["edit-requests"] });
      queryClient.invalidateQueries({ queryKey: ["own-pending-edit", variables.member_id] });
    },
  });
}

export interface EditRequest {
  id: string;
  member_id: number;
  data: Partial<Member>;
  status: "pending" | "approved" | "rejected";
  submitted_by: string;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

/** Fetch pending edit requests (admin) */
export function useEditRequests(statusFilter: "pending" | "all" = "pending") {
  return useQuery({
    queryKey: ["edit-requests", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("member_edit_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (statusFilter === "pending") {
        query = query.eq("status", "pending");
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as EditRequest[];
    },
  });
}

/** Admin: approve an edit request (merge into member_edits) */
export function useApproveEditRequest() {
  const queryClient = useQueryClient();
  const saveMutation = useSaveMemberEdit();

  return useMutation({
    mutationFn: async ({ request }: { request: EditRequest }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error("Niet ingelogd");

      // First get existing edits for this member to merge
      const { data: existingEdits } = await supabase
        .from("member_edits")
        .select("data")
        .eq("member_id", request.member_id)
        .maybeSingle();

      const existingData = (existingEdits?.data as Partial<Member>) || {};
      const mergedData = {
        ...existingData,
        ...request.data,
        // Arrays: use request data if provided
        locaties: request.data.locaties || existingData.locaties,
        contacten: request.data.contacten || existingData.contacten,
      };

      // Save merged edits
      await saveMutation.mutateAsync({
        member_id: request.member_id,
        data: mergedData,
      });

      // Mark request as approved
      const { error } = await supabase
        .from("member_edit_requests")
        .update({
          status: "approved",
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", request.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edit-requests"] });
      queryClient.invalidateQueries({ queryKey: ["member-edits"] });
    },
  });
}

/** Admin: reject an edit request */
export function useRejectEditRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, note }: { requestId: string; note?: string }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error("Niet ingelogd");

      const { error } = await supabase
        .from("member_edit_requests")
        .update({
          status: "rejected",
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          review_note: note || null,
        })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["edit-requests"] });
    },
  });
}
