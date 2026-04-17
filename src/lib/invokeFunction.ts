import { supabase } from "@/integrations/supabase/client";

/**
 * Roept een Supabase edge function aan met expliciet meegegeven sessietoken.
 * Voorkomt dat de anon key als Authorization header wordt gebruikt wanneer
 * supabase-js het session token niet automatisch meestuurt.
 *
 * Bij een 401-respons wordt de sessie automatisch ververst en wordt het
 * verzoek één keer opnieuw geprobeerd met het nieuwe token.
 *
 * Werkt 1:1 als supabase.functions.invoke en geeft hetzelfde { data, error } terug.
 */
type InvokeOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
};

type InvokeResult<T> = {
  data: T | null;
  error: { message: string; name?: string } | null;
};

async function getAccessToken(forceRefresh = false): Promise<string | null> {
  if (forceRefresh) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) return null;
    return data?.session?.access_token ?? null;
  }
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

function isAuthError(error: { message?: string; name?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = (error.message || "").toLowerCase();
  return (
    msg.includes("401") ||
    msg.includes("unauthorized") ||
    msg.includes("jwt") ||
    msg.includes("niet ingelogd") ||
    msg.includes("missing sub claim") ||
    msg.includes("invalid token") ||
    msg.includes("token has expired") ||
    msg.includes("expired")
  );
}

async function callFunction<T>(
  functionName: string,
  options: InvokeOptions,
  token: string,
): Promise<InvokeResult<T>> {
  return (await supabase.functions.invoke(functionName, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })) as InvokeResult<T>;
}

export async function invokeWithAuth<T = any>(
  functionName: string,
  options: InvokeOptions = {},
): Promise<InvokeResult<T>> {
  let token = await getAccessToken();
  if (!token) {
    // No session at all -> try a refresh once before giving up
    token = await getAccessToken(true);
    if (!token) {
      return { data: null, error: { message: "Niet ingelogd. Log opnieuw in.", name: "NoSession" } };
    }
  }

  const first = await callFunction<T>(functionName, options, token);
  if (!isAuthError(first.error)) return first;

  // Auth-related failure -> refresh session and retry once
  const refreshedToken = await getAccessToken(true);
  if (!refreshedToken) {
    return { data: null, error: { message: "Sessie verlopen. Log opnieuw in.", name: "SessionExpired" } };
  }

  return await callFunction<T>(functionName, options, refreshedToken);
}
