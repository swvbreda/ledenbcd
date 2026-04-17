import { supabase } from "@/integrations/supabase/client";

/**
 * Roept een Supabase edge function aan met expliciet meegegeven sessietoken.
 * Voorkomt dat de anon key als Authorization header wordt gebruikt wanneer
 * supabase-js het session token niet automatisch meestuurt.
 *
 * Werkt 1:1 als supabase.functions.invoke en geeft hetzelfde { data, error } terug.
 */
export async function invokeWithAuth<T = any>(
  functionName: string,
  options: { body?: unknown; headers?: Record<string, string>; method?: string } = {},
): Promise<{ data: T | null; error: { message: string; name?: string } | null }> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    return { data: null, error: { message: "Niet ingelogd. Log opnieuw in.", name: "NoSession" } };
  }
  return await supabase.functions.invoke(functionName, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  }) as any;
}
