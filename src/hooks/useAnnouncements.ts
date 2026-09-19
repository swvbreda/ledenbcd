import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MemberAnnouncement {
  id: string;
  title: string;
  body: string;
  link_url: string | null;
  published: boolean;
  published_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const table = () => supabase.from("member_announcements" as any);

export function useAnnouncements(includeDrafts: boolean) {
  return useQuery({
    queryKey: ["member-announcements", includeDrafts],
    queryFn: async () => {
      let query = table()
        .select("*")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (!includeDrafts) query = query.eq("published", true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as MemberAnnouncement[];
    },
  });
}

export function useSaveAnnouncement() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...values
    }: Partial<MemberAnnouncement> &
      Pick<
        MemberAnnouncement,
        "title" | "body" | "published" | "created_by"
      >) => {
      if (id) {
        const { error } = await table().update(values).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await table().insert(values);
      if (error) throw error;
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["member-announcements"] }),
  });
}

export function useDeleteAnnouncement() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await table().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["member-announcements"] }),
  });
}
