import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { completeContactRemoval, type RemovalPlan } from "./contactRemoval";

const input = z.object({ memberId: z.number().int().positive(), patch: z.record(z.unknown()), confirmed: z.boolean().default(false) });
/** Never trusts client email, name or account UUID as an authorization decision. */
export const removeMemberContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ context, data }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (roleError || admin !== true) throw new Error("Alleen een bevoegde beheerder kan contactpersonen verwijderen.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const prepare = async () => {
      const { data: plan, error } = await supabaseAdmin.rpc("contact_removal_prepare", { _member: data.memberId, _patch: data.patch as import("@/integrations/supabase/types").Json, _actor: context.userId, _confirm: data.confirmed });
      if (error) throw new Error(error.message);
      return plan as RemovalPlan;
    };
    if (!data.confirmed) {
      const plan = await prepare();
      return { removed: plan.removed, accounts: plan.accounts };
    }
    const plan = await completeContactRemoval({
      prepare,
      disableAndDelete: async (id) => {
        const { data: existing, error: lookupError } = await supabaseAdmin.auth.admin.getUserById(id);
        if (lookupError && lookupError.status !== 404) throw new Error("Accountcontrole mislukt; contactpersoon behouden en toegang geblokkeerd. Probeer opnieuw.");
        if (!existing?.user || existing.user.deleted_at) return;
        // Ban refresh/login first. Soft delete removes login identity while preserving
        // auth UUID foreign keys (declarations, payments, audit and historical actors).
        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(id, { ban_duration: "876000h" });
        if (banError) throw new Error("Account blokkeren mislukt; contactpersoon behouden en toegang geblokkeerd. Probeer opnieuw.");
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(id, true);
        if (deleteError) throw new Error("Loginaccount verwijderen mislukt; contactpersoon behouden en toegang geblokkeerd. Probeer opnieuw.");
      },
      finish: async (id) => {
        const { error } = await supabaseAdmin.rpc("contact_removal_finish", { _id: id, _actor: context.userId });
        if (error) throw new Error(error.message);
      },
    });
    return { removed: plan.removed, accounts: plan.accounts };
  });