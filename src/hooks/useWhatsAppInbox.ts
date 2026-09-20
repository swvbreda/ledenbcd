import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppConversation {
  id: string;
  wa_id: string;
  profile_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread: number;
}

export interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  wa_message_id: string;
  direction: string;
  message_type: string;
  body: string | null;
  media_mime_type: string | null;
  sent_at: string | null;
  received_at: string;
  read_at: string | null;
}

// De tabellen zijn nieuw; de gegenereerde types kennen ze nog niet.
const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: unknown }>;
  channel: typeof supabase.channel;
  removeChannel: typeof supabase.removeChannel;
};

export function useWhatsAppConversations(enabled: boolean) {
  return useQuery({
    queryKey: ["whatsapp-conversations"],
    enabled,
    queryFn: async (): Promise<WhatsAppConversation[]> => {
      const { data, error } = await db
        .from("whatsapp_conversations")
        .select(
          "id, wa_id, profile_name, last_message_at, last_message_preview",
        )
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;

      const { data: unreadRows, error: unreadError } = await db
        .from("whatsapp_messages")
        .select("conversation_id")
        .is("read_at", null);
      if (unreadError) throw unreadError;

      const unreadByConversation = new Map<string, number>();
      for (const row of (unreadRows ?? []) as { conversation_id: string }[]) {
        unreadByConversation.set(
          row.conversation_id,
          (unreadByConversation.get(row.conversation_id) ?? 0) + 1,
        );
      }

      return ((data ?? []) as Omit<WhatsAppConversation, "unread">[]).map(
        (c) => ({
          ...c,
          unread: unreadByConversation.get(c.id) ?? 0,
        }),
      );
    },
  });
}

export function useWhatsAppMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["whatsapp-messages", conversationId],
    enabled: !!conversationId,
    queryFn: async (): Promise<WhatsAppMessage[]> => {
      const { data, error } = await db
        .from("whatsapp_messages")
        .select(
          "id, conversation_id, wa_message_id, direction, message_type, body, media_mime_type, sent_at, received_at, read_at",
        )
        .eq("conversation_id", conversationId)
        .order("received_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WhatsAppMessage[];
    },
  });
}

/** Markeren als gelezen loopt via een afgeschermde databasefunctie. */
export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await db.rpc("whatsapp_mark_conversation_read", {
        p_conversation_id: conversationId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      queryClient.invalidateQueries({
        queryKey: ["whatsapp-messages", conversationId],
      });
    },
  });
}

/** Eén realtime-abonnement per gemonteerde pagina; wordt netjes opgeruimd. */
export function useWhatsAppRealtime(enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const channel = db
      .channel("whatsapp-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages" },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["whatsapp-conversations"],
          });
          queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
        },
      )
      .subscribe();
    return () => {
      db.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}
