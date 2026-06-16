import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface WAConversation {
  id: string;
  phone: string;
  member_id: number | null;
  display_name: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  archived: boolean;
}

export interface WAMessage {
  id: string;
  member_id: number | null;
  phone: string;
  direction: "inbound" | "outbound";
  body: string | null;
  template_name: string | null;
  status: string;
  error: string | null;
  timestamp: string;
}

export interface WATemplate {
  id: string;
  name: string;
  display_name: string | null;
  language: string;
  category: string;
  status: string;
  body_text: string | null;
  variables: string[];
  last_synced_at: string | null;
}

export interface WAPreference {
  member_id: number;
  opted_in: boolean;
  blocked: boolean;
  opted_in_at: string | null;
  opted_out_at: string | null;
}

export function useWhatsAppConversations() {
  const { user, isAdmin, isBoard } = useAuth();
  return useQuery({
    queryKey: ["wa-conversations"],
    enabled: !!user && (isAdmin || isBoard),
    queryFn: async (): Promise<WAConversation[]> => {
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as WAConversation[];
    },
  });
}

export function useWhatsAppMessages(phone: string | null) {
  const { user, isAdmin, isBoard } = useAuth();
  return useQuery({
    queryKey: ["wa-messages", phone],
    enabled: !!user && (isAdmin || isBoard) && !!phone,
    queryFn: async (): Promise<WAMessage[]> => {
      if (!phone) return [];
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("phone", phone)
        .order("timestamp", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WAMessage[];
    },
  });
}

export function useWhatsAppTemplates() {
  const { user, isAdmin, isBoard } = useAuth();
  return useQuery({
    queryKey: ["wa-templates"],
    enabled: !!user && (isAdmin || isBoard),
    queryFn: async (): Promise<WATemplate[]> => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as WATemplate[];
    },
  });
}

export function useWhatsAppPreferences() {
  const { user, isAdmin, isBoard } = useAuth();
  return useQuery({
    queryKey: ["wa-preferences"],
    enabled: !!user && (isAdmin || isBoard),
    queryFn: async (): Promise<Record<number, WAPreference>> => {
      const { data, error } = await supabase.from("whatsapp_preferences").select("*");
      if (error) throw error;
      const map: Record<number, WAPreference> = {};
      for (const p of (data ?? []) as WAPreference[]) map[p.member_id] = p;
      return map;
    },
  });
}

export function useSendWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      phone: string;
      text?: string;
      template?: { name: string; language?: string; variables?: string[] };
      member_id?: number | null;
    }) => {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", { body: input });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["wa-conversations"] });
      qc.invalidateQueries({ queryKey: ["wa-messages", vars.phone] });
      toast({ title: "Bericht verzonden" });
    },
    onError: (err: Error) => {
      toast({ title: "Verzenden mislukt", description: err.message, variant: "destructive" });
    },
  });
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from("whatsapp_conversations")
        .update({ unread_count: 0 })
        .eq("id", conversationId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-conversations"] }),
  });
}

export function useSetWhatsAppPreference() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { member_id: number; opted_in?: boolean; blocked?: boolean }) => {
      const now = new Date().toISOString();
      const payload: Record<string, unknown> = {
        member_id: input.member_id,
        updated_by: user?.id ?? null,
      };
      if (input.opted_in !== undefined) {
        payload.opted_in = input.opted_in;
        if (input.opted_in) payload.opted_in_at = now;
        else payload.opted_out_at = now;
      }
      if (input.blocked !== undefined) payload.blocked = input.blocked;
      const { error } = await supabase.from("whatsapp_preferences").upsert(payload, { onConflict: "member_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa-preferences"] });
      toast({ title: "Voorkeur bijgewerkt" });
    },
    onError: (err: Error) => toast({ title: "Bijwerken mislukt", description: err.message, variant: "destructive" }),
  });
}