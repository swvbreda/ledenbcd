import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ATTACHMENT_TYPES } from "@/lib/supportWhatsApp";

export interface SupportThread {
  id: string; subject: string; status: string; channel: string;
  admin_unread: boolean; member_unread?: boolean; last_activity_at: string;
  member_id: number; member_name?: string | null; project_id: string | null; link_active?: boolean;
}
export interface SupportMessage {
  id: string; thread_id: string; author_kind: string; channel: string; body: string;
  wa_status: string | null; wa_error: string | null; sent_at: string; author_user_id: string | null;
}
export interface SupportAttachment { id: string; message_id: string; path: string; file_name: string; mime: string; size: number }

export function useMyThreads(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["support-threads", "mine", userId],
    enabled: enabled && !!userId,
    refetchInterval: SUPPORT_POLL_MS,
    queryFn: async (): Promise<SupportThread[]> => {
      const { data, error } = await supabase.from("support_threads")
        .select("id,subject,status,channel,admin_unread,member_unread,last_activity_at,member_id,project_id")
        .eq("user_id", userId!).order("last_activity_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminThreads(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["support-threads", "admin", userId],
    enabled: enabled && !!userId,
    refetchInterval: SUPPORT_POLL_MS,
    queryFn: async (): Promise<SupportThread[]> => {
      const { data, error } = await supabase.rpc("support_admin_threads");
      if (error) throw error;
      return (data ?? []) as SupportThread[];
    },
  });
}

export function useThreadDetail(userId: string | undefined, threadId: string | null) {
  return useQuery({
    queryKey: ["support-thread", userId, threadId],
    enabled: !!userId && !!threadId,
    refetchInterval: SUPPORT_POLL_MS,
    queryFn: async () => {
      const [m, a] = await Promise.all([
        supabase.from("support_messages")
          .select("id,thread_id,author_kind,channel,body,wa_status,wa_error,sent_at,author_user_id")
          .eq("thread_id", threadId!).order("sent_at", { ascending: true }),
        supabase.from("support_attachments").select("id,message_id,path,file_name,mime,size").eq("thread_id", threadId!),
      ]);
      if (m.error) throw m.error;
      if (a.error) throw a.error;
      // No signed URLs here: they are minted on explicit click (openSupportAttachment) under current RLS.
      return { messages: (m.data ?? []) as SupportMessage[], attachments: (a.data ?? []) as SupportAttachment[] };
    },
  });
}

export function useMemberProjects(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["member-project-options", userId],
    enabled: enabled && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_member_project_status");
      if (error) throw error;
      return (data ?? []).map((p: { id: string; title: string }) => ({ id: p.id, title: p.title }));
    },
  });
}

export function useMyWhatsAppLink(userId: string | undefined, enabled: boolean, poll = false) {
  return useQuery({
    queryKey: ["support-wa-link", userId],
    enabled: enabled && !!userId,
    refetchInterval: poll ? 5_000 : false,
    queryFn: async () => {
      const { data, error } = await supabase.from("whatsapp_member_links")
        .select("id,phone,verified_at").eq("user_id", userId!).is("revoked_at", null).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Polls only the caller's own RLS-scoped rows while the tab is visible (react-query skips background tabs). */
export const SUPPORT_POLL_MS = 20_000;

/** Mint a short-lived signed URL only on explicit click; RLS on storage decides. Never a public URL. */
export async function openSupportAttachment(path: string): Promise<string | null> {
  const s = await supabase.storage.from("support-attachments").createSignedUrl(path, 60);
  return s.error || !s.data?.signedUrl ? null : s.data.signedUrl;
}

export async function uploadAttachments(threadId: string, messageId: string, userId: string, files: File[]) {
  const failed: string[] = [];
  for (const file of files) {
    const path = `${threadId}/${userId}/${crypto.randomUUID()}.${ATTACHMENT_TYPES[file.type]}`;
    const up = await supabase.storage.from("support-attachments").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) { failed.push(file.name); continue; }
    const reg = await supabase.rpc("support_add_attachment", { p_thread: threadId, p_message: messageId, p_path: path, p_file_name: file.name });
    if (reg.error) failed.push(file.name);
  }
  return failed;
}

export function useSupportInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["support-threads"] });
    qc.invalidateQueries({ queryKey: ["support-thread"] });
  };
}

export function useMarkSupportRead() {
  const invalidate = useSupportInvalidate();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase.rpc("support_mark_read", { p_thread: threadId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
