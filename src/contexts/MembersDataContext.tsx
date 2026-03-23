import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Member } from "@/data/types";

interface MembersDataContextType {
  rawMembers: Member[];
  rawLeads: Member[];
  allRepresented: Member[];
  allMembersAndLeads: Member[];
  isLoading: boolean;
}

const MembersDataContext = createContext<MembersDataContextType>({
  rawMembers: [],
  rawLeads: [],
  allRepresented: [],
  allMembersAndLeads: [],
  isLoading: true,
});

export function MembersDataProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["members-data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members_data")
        .select("id, member_type, data");
      if (error) throw error;
      return data;
    },
  });

  const { rawMembers, rawLeads, allRepresented, allMembersAndLeads } = useMemo(() => {
    const rows = data ?? [];
    const members = rows
      .filter((r) => r.member_type === "member")
      .map((r) => r.data as unknown as Member);
    const leads = rows
      .filter((r) => r.member_type === "lead")
      .map((r) => r.data as unknown as Member);
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
