import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { locationKeyOf } from "@/lib/registerLocationMatch";

/**
 * Ruimt dubbele vestigingen binnen één lid op: de gekozen vestiging blijft
 * staan en wordt aangevuld met gegevens uit de dubbele regels; de dubbele
 * regels verdwijnen. Bestaande registerkoppelingen verhuizen mee.
 */
export function useMergeDuplicateLocations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { memberId: number; keepKey: string; removeKeys: string[] }) => {
      const { memberId, keepKey, removeKeys } = input;
      if (!removeKeys.length) return;

      // Altijd eerst ophalen en samenvoegen; nooit blind overschrijven.
      const { data: row, error } = await supabase
        .from("members_data")
        .select("id, data")
        .eq("id", memberId)
        .maybeSingle();
      if (error) throw error;
      if (!row) throw new Error("Lid niet gevonden");

      const data: any = JSON.parse(JSON.stringify((row as any).data ?? {}));
      const locaties: any[] = Array.isArray(data.locaties) ? data.locaties : [];

      const keep = locaties.find((l) => locationKeyOf(l) === keepKey);
      if (!keep) throw new Error("Vestiging niet gevonden bij dit lid");

      const remove = new Set(removeKeys);
      const overige: any[] = [];
      for (const loc of locaties) {
        const key = locationKeyOf(loc);
        if (loc === keep || !remove.has(key)) {
          overige.push(loc);
          continue;
        }
        // Lege velden van de blijvende vestiging aanvullen uit de dubbele regel.
        for (const [veld, waarde] of Object.entries(loc ?? {})) {
          const bestaand = keep[veld];
          const leeg = bestaand === undefined || bestaand === null || String(bestaand).trim() === "";
          if (leeg && waarde !== undefined && waarde !== null && String(waarde).trim() !== "") {
            keep[veld] = waarde;
          }
        }
      }

      data.locaties = overige;
      const { error: upErr } = await supabase.from("members_data").update({ data }).eq("id", memberId);
      if (upErr) throw upErr;

      // Koppelingen die naar een verwijderde vestiging wezen, wijzen nu naar de blijvende.
      const { error: linkErr } = await supabase
        .from("coffeeshop_member_links")
        .update({ location_key: locationKeyOf(keep) })
        .eq("member_id", memberId)
        .in("location_key", Array.from(remove));
      if (linkErr) throw linkErr;
    },
    onSuccess: () => {
      toast.success("Dubbele vestiging samengevoegd");
      qc.invalidateQueries({ queryKey: ["members-data"] });
      qc.invalidateQueries({ queryKey: ["coffeeshop-register-links"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Samenvoegen mislukt"),
  });
}
