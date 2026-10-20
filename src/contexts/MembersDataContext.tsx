import { createContext, useContext, useMemo, useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Member } from "@/data/types";
import { useAuth } from "@/hooks/useAuth";
import { directoryAccess, mergeDirectory, visibleMemberRows } from "@/lib/memberDirectory";

interface MembersDataContextType {
  rawMembers: Member[];
  rawLeads: Member[];
  rawOldMembers: Member[];
  allRepresented: Member[];
  allMembersAndLeads: Member[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

interface MembersDataRow {
  id: number;
  member_type: string;
  data: unknown;
}

const MembersDataContext = createContext<MembersDataContextType>({
  rawMembers: [],
  rawLeads: [],
  rawOldMembers: [],
  allRepresented: [],
  allMembersAndLeads: [],
  isLoading: true,
  isError: false,
  refetch: () => {},
});

const toMember = (row: MembersDataRow): Member => {
  const payload = (row.data ?? {}) as Partial<Member>;
  return {
    ...payload,
    id: row.id,
  } as Member;
};

export function MembersDataProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, isAdmin, isBoard, isExtern, isInhuur, linkedMemberIds } = useAuth();
  const queryClient = useQueryClient();

  const { canReadAll, canUseDirectory } = directoryAccess({
    isAdmin,
    isBoard,
    isExtern,
    isInhuur,
    linkedMemberIds,
  });

  const canSeeLeads = isAdmin || isBoard || isInhuur;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["members-data", user?.id ?? null, canReadAll, canUseDirectory, canSeeLeads],
    enabled: !!user && !authLoading,
    queryFn: async () => {
      let query = supabase
        .from("members_data")
        .select("id, member_type, data");
      if (!canSeeLeads) query = query.neq("member_type", "lead");
      const { data, error } = await query;
      if (error) throw error;
      const ownRows = (data ?? []) as MembersDataRow[];
      if (!canUseDirectory) return ownRows;

      const { data: directory, error: dirError } = await supabase.rpc("get_members_directory");
      if (dirError) throw dirError;
      return mergeDirectory(ownRows, (directory ?? []) as MembersDataRow[]);
    },
  });

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["members-data"] });
  }, [queryClient]);

  const { rawMembers, rawLeads, rawOldMembers, allRepresented, allMembersAndLeads } = useMemo(() => {
    const rows = visibleMemberRows(!user || authLoading ? [] : data ?? [], canSeeLeads);
    const members = rows.filter((r) => r.member_type === "member").map(toMember);
    const leads = rows.filter((r) => r.member_type === "lead").map(toMember);
    const oldMembers = rows.filter((r) => r.member_type === "old").map(toMember);

    return {
      rawMembers: members,
      rawLeads: leads,
      rawOldMembers: oldMembers,
      allRepresented: [...members, ...leads],
      allMembersAndLeads: [...members, ...leads],
    };
  }, [data, user, authLoading, canSeeLeads]);

  return (
    <MembersDataContext.Provider
      value={{ rawMembers, rawLeads, rawOldMembers, allRepresented, allMembersAndLeads, isLoading: authLoading || isLoading, isError, refetch }}
    >
      {children}
    </MembersDataContext.Provider>
  );
}

export function useMembersData() {
  return useContext(MembersDataContext);
}
