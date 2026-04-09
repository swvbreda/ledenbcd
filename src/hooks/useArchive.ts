import { supabase } from "@/integrations/supabase/client";

/**
 * Archive a member by setting member_type = 'old' in the database.
 * This persists across sessions and devices.
 */
export const archiveMember = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from("members_data")
    .update({ member_type: "old" })
    .eq("id", id);
  if (error) throw error;
};

/**
 * Restore an archived member by setting member_type = 'member'.
 */
export const restoreMember = async (id: number): Promise<void> => {
  const { error } = await supabase
    .from("members_data")
    .update({ member_type: "member" })
    .eq("id", id);
  if (error) throw error;
};
