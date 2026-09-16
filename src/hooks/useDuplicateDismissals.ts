import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Groepen die het bestuur al heeft beoordeeld; die komen niet meer terug. */
export function useDuplicateDismissals() {
  return useQuery({
    queryKey: ["location-duplicate-dismissals"],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from("location_duplicate_dismissals")
        .select("groep_sleutel");
      if (error) throw error;
      return new Set((data ?? []).map((r: any) => r.groep_sleutel as string));
    },
  });
}

export function useDismissDuplicate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { key: string; reden?: string }) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("location_duplicate_dismissals")
        .upsert(
          { groep_sleutel: input.key, reden: input.reden ?? null, door: auth.user?.id ?? null },
          { onConflict: "groep_sleutel" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Beoordeeld — dit komt niet meer terug");
      qc.invalidateQueries({ queryKey: ["location-duplicate-dismissals"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Opslaan mislukt"),
  });
}
