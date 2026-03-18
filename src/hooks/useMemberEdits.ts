import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { allMembers, allMembersAndLeads } from "@/hooks/useMembers";
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

export function useMergedMember(memberId: number): { member: Member | undefined; isLoading: boolean } {
  const { data: editsMap, isLoading } = useMemberEdits();
  const baseMember = allMembersAndLeads.find((m) => m.id === memberId);

  if (!baseMember) return { member: undefined, isLoading };

  const edits = editsMap?.get(memberId);
  if (!edits) return { member: baseMember, isLoading };

  // Deep merge: base + edits
  const merged: Member = {
    ...baseMember,
    ...edits,
    // Arrays need special handling
    locaties: edits.locaties || baseMember.locaties,
    contacten: edits.contacten || baseMember.contacten,
  };

  return { member: merged, isLoading };
}

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
