import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Concept-snapshot Begroting 2027: data staat alleen server-side en wordt
// pas na een beheerderscontrole onder de eigen sessie geleverd.
export const getBegroting2027 = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { begroting2027ForCaller } = await import("./begroting2027Concept.server");
    return begroting2027ForCaller(context.supabase as never, context.userId);
  });
