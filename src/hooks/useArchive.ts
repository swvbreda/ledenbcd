import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth } from "@/lib/invokeFunction";

/**
 * Archiveert een lid. Het archiefrecord krijgt een historienummer (vanaf 10001)
 * zodat het lidnummer weer vrijkomt voor een nieuw lid; alle facturen,
 * betalingen en koppelingen verhuizen mee. Het relatienummer in Informer wordt
 * daarna gelijkgetrokken.
 */
export const archiveMember = async (id: number): Promise<number> => {
  const { data, error } = await supabase.rpc("archive_member_with_renumber", {
    _member_id: id,
  });
  if (error) throw error;

  const nieuwNummer = Number(data) || id;

  if (nieuwNummer !== id) {
    // Boekhouding bijwerken; lukt dat niet, dan komt er een taak in Financiën.
    try {
      await invokeWithAuth("informer-sync?action=rename_relation", {
        method: "POST",
        body: { old_member_id: id, new_member_id: nieuwNummer },
      });
    } catch (e) {
      console.warn("Relatienummer in Informer bijwerken mislukt", e);
    }
  }

  return nieuwNummer;
};

/**
 * Herstelt een gearchiveerd lid. Een historienummer wordt daarbij niet
 * teruggezet: het lid houdt het nummer waaronder het is gearchiveerd.
 */
export const restoreMember = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from("members_data")
    .update({ member_type: "member" })
    .eq("id", id);
  if (error) throw error;
};
