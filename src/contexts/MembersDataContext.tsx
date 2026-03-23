import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Member } from "@/data/types";
import { useAuth } from "@/hooks/useAuth";

interface MembersDataContextType {
  rawMembers: Member[];
  rawLeads: Member[];
  allRepresented: Member[];
  allMembersAndLeads: Member[];
  isLoading: boolean;
}

interface MembersDataRow {
  id: number;
  member_type: string;
  data: unknown;
}

const MembersDataContext = createContext<MembersDataContextType>({
  rawMembers: [],
  rawLeads: [],
  allRepresented: [],
  allMembersAndLeads: [],
  isLoading: true,
});

const toMember = (row: MembersDataRow): Member => {
  const payload = (row.data ?? {}) as Partial<Member>;
  return {
    ...payload,
    id: typeof payload.id === "number" ? payload.id : row.id,
  } as Member;
};

export function MembersDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["members-data", user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members_data")
        .select("id, member_type, data");
      if (error) throw error;
      return (data ?? []) as MembersDataRow[];
    },
  });

  const { rawMembers, rawLeads, allRepresented, allMembersAndLeads } = useMemo(() => {
    const rows = data ?? [];
    const members = rows.filter((r) => r.member_type === "member").map(toMember);
    const leads = rows.filter((r) => r.member_type === "lead").map(toMember);

    return {
      rawMembers: members,
      rawLeads: leads,
      allRepresented: [...members, ...leads],
      allMembersAndLeads: [...members, ...leads],
    };
  }, [data]);

  return (
    <MembersDataContext.Provider
      value={{ rawMembers, rawLeads, allRepresented, allMembersAndLeads, isLoading }}
    >
      {children}
    </MembersDataContext.Provider>
  );
}

export function useMembersData() {
  return useContext(MembersDataContext);
}
