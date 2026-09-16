import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgendaGuestRegistration {
  id: string;
  event_id: string;
  naam: string;
  organisatie: string | null;
  email: string;
  telefoon: string | null;
  guests: number;
  note: string | null;
  status: string;
  created_at: string;
}

/** Aanmeldingen van niet-leden via de publieke deellink (alleen bestuur/beheer). */
export function useAgendaGuests(eventId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["agenda-guests", eventId],
    enabled: !!eventId && enabled,
    queryFn: async (): Promise<AgendaGuestRegistration[]> => {
      const { data, error } = await supabase
        .from("agenda_guest_registrations")
        .select("*")
        .eq("event_id", eventId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AgendaGuestRegistration[];
    },
  });
}

export function useDeleteAgendaGuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda_guest_registrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["agenda-guests"] });
    },
  });
}
