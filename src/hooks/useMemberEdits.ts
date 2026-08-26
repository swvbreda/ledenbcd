import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useAuth } from "@/hooks/useAuth";
import type { Member } from "@/data/types";
import { useLeadConversions } from "@/hooks/useLeadConversions";
import { locationIdentity, mergeMemberLocations } from "@/lib/memberLocations";

type MemberEditData = Partial<Member> & { _verwijderdeLocaties?: string[] };

interface MemberEdit {
  member_id: number;
  data: MemberEditData;
}

/** Drop placeholder location rows that have neither address nor place */
const cleanLocaties = <T extends { naam?: string; adres?: string; plaats?: string }>(locaties: T[]): T[] =>
  (locaties || []).filter((l) => !!(l.adres?.trim() || l.plaats?.trim()));

export function useMemberEdits() {
  return useQuery({
    queryKey: ["member-edits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_edits")
        .select("member_id, data");
      if (error) throw error;
      const map = new Map<number, MemberEditData>();
      for (const row of data || []) {
        map.set(row.member_id, row.data as MemberEditData);
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
      return data?.data as MemberEditData | null;
    },
  });
}

export function useMergedMember(memberId: number): { member: Member | undefined; isLoading: boolean; hasPendingEdit: boolean } {
  const { data: editsMap, isLoading: editsLoading } = useMemberEdits();
  const { data: pendingEdit, isLoading: pendingLoading } = useOwnPendingEdit(memberId);
  const { allMembersAndLeads, rawLeads, rawOldMembers } = useMembersData();
  const { conversions, loading: conversionsLoading } = useLeadConversions();

  // First try direct lookup (including old members), then check if this memberId is a converted lead's new lidnummer
  let baseMember = allMembersAndLeads.find((m) => m.id === memberId)
    ?? rawOldMembers.find((m) => m.id === memberId);
  if (!baseMember) {
    const conv = conversions.find((c) => c.lidnummer === memberId);
    if (conv) {
      const originalLead = rawLeads.find((l) => l.id === conv.lead_id);
      if (originalLead) {
        baseMember = {
          ...originalLead,
          id: conv.lidnummer,
          lidSinds: conv.lid_sinds,
          factuurBedrijfsnaam: conv.factuur_bedrijfsnaam || originalLead.factuurBedrijfsnaam,
          factuurKvk: conv.factuur_kvk || undefined,
          factuurEmail: conv.factuur_email || originalLead.factuurEmail,
          factuurAdres: conv.factuur_adres || originalLead.factuurAdres,
          factuurPostcode: conv.factuur_postcode || originalLead.factuurPostcode,
          factuurPlaats: conv.factuur_plaats || originalLead.factuurPlaats,
        } as Member;
      }
    }
  }

  const isLoading = editsLoading || pendingLoading || conversionsLoading;
  const hasPendingEdit = !!pendingEdit;

  if (!baseMember) return { member: undefined, isLoading, hasPendingEdit };

  // Start with base, apply approved edits, then overlay pending edit for own profile
  const edits = editsMap?.get(memberId);
  let merged: Member = baseMember;

  if (edits) {
    const mergedLocaties = cleanLocaties(
      mergeMemberLocations(merged.locaties, edits.locaties, edits._verwijderdeLocaties),
    );
    merged = {
      ...merged,
      ...edits,
      locaties: mergedLocaties,
      contacten: edits.contacten || merged.contacten,
      aantalLocaties: mergedLocaties.length,
    };
  }

  if (pendingEdit) {
    const mergedLocaties = cleanLocaties(
      mergeMemberLocations(merged.locaties, pendingEdit.locaties, pendingEdit._verwijderdeLocaties),
    );
    merged = {
      ...merged,
      ...pendingEdit,
      locaties: mergedLocaties,
      contacten: pendingEdit.contacten || merged.contacten,
      aantalLocaties: mergedLocaties.length,
    };
  }

  return { member: merged, isLoading, hasPendingEdit };
}

/** Apply all edits to an array of members */
export function useMergedMembers(members: Member[]): { members: Member[]; isLoading: boolean } {
  const { data: editsMap, isLoading } = useMemberEdits();

  const merged = useMemo(() => {
    return members.map((m) => {
      const edits = editsMap?.get(m.id);
      const mergedLocaties = cleanLocaties(
        mergeMemberLocations(m.locaties, edits?.locaties, edits?._verwijderdeLocaties),
      );
      if (!edits && mergedLocaties.length === (m.locaties?.length ?? 0)) return m;
      return {
        ...m,
        ...(edits || {}),
        locaties: mergedLocaties,
        contacten: edits?.contacten || m.contacten,
        aantalLocaties: mergedLocaties.length,
      };
    });
  }, [members, editsMap]);

  return { members: merged, isLoading };
}

/** Admin: save directly to member_edits (approved immediately) */
export function useSaveMemberEdit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ member_id, data, skipMerge }: MemberEdit & { skipMerge?: boolean }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error("Niet ingelogd");

      let finalData: MemberEditData = data;
      let existingData: MemberEditData = {};

      const { data: memberRow } = await supabase
        .from("members_data")
        .select("data")
        .eq("id", member_id)
        .maybeSingle();
      const baseMember = (memberRow?.data as Partial<Member> | null) ?? {};

      // Merge with existing edits to prevent data loss
      if (!skipMerge) {
        const { data: existing } = await supabase
          .from("member_edits")
          .select("data")
          .eq("member_id", member_id)
          .maybeSingle();

        if (existing?.data) {
          existingData = existing.data as MemberEditData;
          finalData = {
            ...existingData,
            ...data,
            // Arrays from the new data take precedence when provided
            locaties: data.locaties || existingData.locaties,
            contacten: data.contacten || existingData.contacten,
          };
        }
      }

      if (data.locaties) {
        const previousLocations = mergeMemberLocations(
          baseMember.locaties,
          existingData.locaties,
          existingData._verwijderdeLocaties,
        );
        const removedNow = previousLocations
          .filter((previous) => !data.locaties?.some((current) => locationIdentity(current) === locationIdentity(previous)))
          .map(locationIdentity);
        const retainedRemoved = (existingData._verwijderdeLocaties ?? []).filter(
          (identity) => !data.locaties?.some((current) => locationIdentity(current) === identity),
        );
        finalData = {
          ...finalData,
          locaties: data.locaties,
          _verwijderdeLocaties: Array.from(new Set([...retainedRemoved, ...removedNow])),
        };
      }

      const { error } = await supabase
        .from("member_edits")
        .upsert(
          {
            member_id,
            data: finalData as any,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "member_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["member-edits"] });
      // Tellingen (vertegenwoordiging/register) meteen mee verversen
      queryClient.invalidateQueries({ queryKey: ["members-data"] });
      queryClient.invalidateQueries({ queryKey: ["register-plaats-stats"] });
      queryClient.invalidateQueries({ queryKey: ["register-links"] });
      queryClient.invalidateQueries({ queryKey: ["register-link-summary"] });
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
  data: MemberEditData;
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

  return useMutation({
    mutationFn: async ({ request }: { request: EditRequest }) => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error("Niet ingelogd");

      // Fetch the latest existing edits directly (bypass cache to prevent race conditions)
      const { data: existingEdits } = await supabase
        .from("member_edits")
        .select("data")
        .eq("member_id", request.member_id)
        .maybeSingle();

      const existingData = (existingEdits?.data as MemberEditData) || {};
      const mergedData = {
        ...existingData,
        ...request.data,
        // Arrays: use request data if provided (it represents the full desired state)
        locaties: request.data.locaties || existingData.locaties,
        contacten: request.data.contacten || existingData.contacten,
      };

      // Save merged edits directly (skip the extra merge in useSaveMemberEdit since we already merged)
      const { error: upsertError } = await supabase
        .from("member_edits")
        .upsert(
          {
            member_id: request.member_id,
            data: mergedData as any,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "member_id" }
        );
      if (upsertError) throw upsertError;

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
      queryClient.invalidateQueries({ queryKey: ["members-data"] });
      queryClient.invalidateQueries({ queryKey: ["register-plaats-stats"] });
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
