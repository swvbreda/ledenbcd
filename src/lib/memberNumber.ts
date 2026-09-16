import { supabase } from "@/integrations/supabase/client";

/**
 * Het eerstvolgende vrije lidnummer. De database bepaalt dit centraal, zodat
 * gaten worden opgevuld en twee gelijktijdige aanmaken nooit hetzelfde nummer
 * kunnen krijgen.
 */
export async function nextMemberNumber(): Promise<number> {
  const { data, error } = await supabase.rpc("next_member_number");
  if (error) throw error;
  const nummer = Number(data);
  if (!Number.isFinite(nummer) || nummer <= 0) throw new Error("Geen vrij lidnummer gevonden");
  return nummer;
}
