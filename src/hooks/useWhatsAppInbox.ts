import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WhatsAppConversation {
  id: string;
  phone: string;
  display_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
}

export interface WhatsAppMessage {
  id: string;
  phone: string;
  direction: string;
  message_type: string;
  body: string | null;
  media_type: string | null;
  timestamp: string;
  read_by_us_at: string | null;
}

export function useWhatsAppConversations(enabled: boolean) {
  return useQuery({
    queryKey: ["whatsapp-conversations"],
    enabled,
    queryFn: async (): Promise<WhatsAppConversation[]> => {
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select(
          "id, phone, display_name, last_message_at, last_message_preview, unread_count",
        )
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWhatsAppMessages(phone: string | null) {
  return useQuery({
    queryKey: ["whatsapp-messages", phone],
    enabled: !!phone,
    queryFn: async (): Promise<WhatsAppMessage[]> => {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select(
          "id, phone, direction, message_type, body, media_type, timestamp, read_by_us_at",
        )
        .eq("phone", phone!)
        .order("timestamp", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Markeren als gelezen loopt via een afgeschermde databasefunctie. */
export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase.rpc("whatsapp_mark_conversation_read", {
        p_conversation_id: conversationId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
    },
  });
}

/** Eén realtime-abonnement per gemonteerde pagina; wordt netjes opgeruimd. */
export function useWhatsAppRealtime(enabled: boolean) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("whatsapp-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-conversations"] });
          queryClient.invalidateQueries({ queryKey: ["whatsapp-messages"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}
