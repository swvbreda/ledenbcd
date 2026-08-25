import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AgendaEventType = "bestuursvergadering" | "evenement";

export interface AgendaEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: AgendaEventType;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  max_seats: number | null;
  image_path: string | null;
  is_published: boolean;

  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AgendaEventInput = Omit<
  AgendaEvent,
  "id" | "created_at" | "updated_at" | "created_by"
>;

export interface AgendaRegistration {
  id: string;
  event_id: string;
  member_id: number;
  guests: number;
  note: string | null;
  registered_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useAgendaEvents() {
  return useQuery({
    queryKey: ["agenda-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_events" as any)
        .select("*")
        .order("event_date", { ascending: true })
        .order("start_time", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return (data ?? []) as unknown as AgendaEvent[];
    },
  });
}

/** Aanmeldingen die de huidige gebruiker mag zien (eigen aanmeldingen, of alles voor admins). */
export function useAgendaRegistrations() {
  return useQuery({
    queryKey: ["agenda-registrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agenda_registrations" as any)
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AgendaRegistration[];
    },
  });
}

export function useAgendaMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["agenda-events"] });
    qc.invalidateQueries({ queryKey: ["agenda-registrations"] });
  };

  const saveEvent = useMutation({
    mutationFn: async (event: AgendaEventInput & { id?: string }) => {
      const { id, ...fields } = event;
      if (id) {
        const { error } = await supabase
          .from("agenda_events" as any)
          .update(fields as any)
          .eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("agenda_events" as any)
        .insert({ ...fields, created_by: userData.user?.id ?? null } as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: invalidate,
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda_events" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const register = useMutation({
    mutationFn: async (input: {
      event_id: string;
      member_id: number;
      guests: number;
      note?: string | null;
      id?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (input.id) {
        const { error } = await supabase
          .from("agenda_registrations" as any)
          .update({ guests: input.guests, note: input.note ?? null } as any)
          .eq("id", input.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("agenda_registrations" as any).insert({
        event_id: input.event_id,
        member_id: input.member_id,
        guests: input.guests,
        note: input.note ?? null,
        registered_by: userData.user?.id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const unregister = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda_registrations" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Zet de eerste donderdag van elke maand in een jaar als bestuursvergadering. */
  const generateMeetings = useMutation({
    mutationFn: async (year: number) => {
      const { data: userData } = await supabase.auth.getUser();
      const rows = [];
      for (let month = 0; month < 12; month++) {
        const d = new Date(Date.UTC(year, month, 1));
        // 4 = donderdag
        const offset = (4 - d.getUTCDay() + 7) % 7;
        d.setUTCDate(1 + offset);
        rows.push({
          title: "Bestuursvergadering",
          event_type: "bestuursvergadering",
          event_date: d.toISOString().slice(0, 10),
          start_time: "10:30",
          end_time: "12:30",
          location: "Witbolstraat",
          is_published: true,
          created_by: userData.user?.id ?? null,
        });
      }
      const { error } = await supabase
        .from("agenda_events" as any)
        .upsert(rows as any, { onConflict: "event_type,event_date,title", ignoreDuplicates: true });
      if (error) throw error;
      return rows.length;
    },
    onSuccess: invalidate,
  });

  return { saveEvent, deleteEvent, register, unregister, generateMeetings };
}

export const formatEventDate = (date: string) =>
  new Date(date + "T00:00:00").toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const formatTimeRange = (start: string | null, end: string | null) => {
  const clean = (t: string | null) => (t ? t.slice(0, 5) : null);
  const s = clean(start);
  const e = clean(end);
  if (s && e) return `${s} – ${e}`;
  return s ?? "";
};

export const isUpcoming = (event: AgendaEvent) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(event.event_date + "T00:00:00") >= today;
};
