import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webauthn`;

function base64urlToBuffer(base64url: string): ArrayBuffer {
  let str = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let str = "";
  for (const byte of bytes) str += String.fromCharCode(byte);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/**
 * Check if WebAuthn/Passkeys is supported by the browser
 */
export function isPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.PublicKeyCredential &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
  );
}

/**
 * Check if a platform authenticator (Face ID, Touch ID, Windows Hello) is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Hook for WebAuthn passkey registration and authentication
 */
export function usePasskeys() {
  const [available, setAvailable] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check availability on mount
  useEffect(() => {
    (async () => {
      const platformAvailable = await isPlatformAuthenticatorAvailable();
      setAvailable(platformAvailable);
      setChecking(false);
    })();
  }, []);

  // Check if current user has registered passkeys
  const checkUserPasskeys = useCallback(async () => {
    const { data } = await supabase.from("passkey_credentials").select("id").limit(1);
    setHasPasskey((data?.length ?? 0) > 0);
  }, []);

  useEffect(() => {
    // Only check if user is logged in
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) checkUserPasskeys();
    });
  }, [checkUserPasskeys]);

  /**
   * Register a new passkey for the current logged-in user
   */
  const registerPasskey = useCallback(async (deviceName?: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();

      // Get registration options from server
      const optRes = await fetch(`${FUNC_URL}?action=register-options`, { headers });
      if (!optRes.ok) {
        const err = await optRes.json();
        setLoading(false);
        return { success: false, error: err.error || "Kon registratie niet starten" };
      }
      const options = await optRes.json();

      // Create credential via browser API
      const credential = (await navigator.credentials.create({
        publicKey: {
          ...options,
          challenge: base64urlToBuffer(options.challenge),
          user: {
            ...options.user,
            id: base64urlToBuffer(options.user.id),
          },
          excludeCredentials: (options.excludeCredentials || []).map((c: any) => ({
            ...c,
            id: base64urlToBuffer(c.id),
          })),
        },
      })) as PublicKeyCredential | null;

      if (!credential) {
        setLoading(false);
        return { success: false, error: "Registratie geannuleerd" };
      }

      const attestationResponse = credential.response as AuthenticatorAttestationResponse;

      // Send to server for verification
      const verifyRes = await fetch(`${FUNC_URL}?action=register-verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          credential: {
            id: credential.id,
            rawId: bufferToBase64url(credential.rawId),
            type: credential.type,
            response: {
              clientDataJSON: bufferToBase64url(attestationResponse.clientDataJSON),
              attestationObject: bufferToBase64url(attestationResponse.attestationObject),
              transports: attestationResponse.getTransports?.() || [],
            },
          },
          deviceName,
          challengeToken: options.challengeToken,
        }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        setLoading(false);
        return { success: false, error: err.error || "Registratie mislukt" };
      }

      setHasPasskey(true);
      setLoading(false);
      return { success: true };
    } catch (err: any) {
      setLoading(false);
      if (err?.name === "NotAllowedError") return { success: false };
      return { success: false, error: "Registratie mislukt" };
    }
  }, []);

  /**
   * Authenticate with a passkey (no login required)
   */
  const authenticateWithPasskey = useCallback(async (email?: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      };

      // Get authentication options
      const optRes = await fetch(`${FUNC_URL}?action=auth-options`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email }),
      });
      if (!optRes.ok) {
        setLoading(false);
        return { success: false, error: "Kon inloggen niet starten" };
      }
      const options = await optRes.json();

      // Create assertion via browser API
      const publicKeyOptions: PublicKeyCredentialRequestOptions = {
        challenge: base64urlToBuffer(options.challenge),
        rpId: options.rpId,
        timeout: options.timeout,
        userVerification: options.userVerification,
      };

      if (options.allowCredentials?.length) {
        publicKeyOptions.allowCredentials = options.allowCredentials.map((c: any) => ({
          id: base64urlToBuffer(c.id),
          type: c.type,
          transports: c.transports,
        }));
      }

      const credential = (await navigator.credentials.get({
        publicKey: publicKeyOptions,
      })) as PublicKeyCredential | null;

      if (!credential) {
        setLoading(false);
        return { success: false };
      }

      const assertionResponse = credential.response as AuthenticatorAssertionResponse;

      // Send to server for verification
      const verifyRes = await fetch(`${FUNC_URL}?action=auth-verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          credential: {
            id: credential.id,
            rawId: bufferToBase64url(credential.rawId),
            type: credential.type,
            response: {
              clientDataJSON: bufferToBase64url(assertionResponse.clientDataJSON),
              authenticatorData: bufferToBase64url(assertionResponse.authenticatorData),
              signature: bufferToBase64url(assertionResponse.signature),
              userHandle: assertionResponse.userHandle ? bufferToBase64url(assertionResponse.userHandle) : null,
            },
          },
          challengeToken: options.challengeToken,
        }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        setLoading(false);
        return { success: false, error: err.error || "Verificatie mislukt" };
      }

      const result = await verifyRes.json();

      // Set the session from the returned tokens
      if (result.session) {
        // Mark MFA as verified BEFORE setting session, so the auth state
        // change handler sees the flag immediately
        if (result.session.user?.id) {
          localStorage.setItem(`emfa_${result.session.user.id}`, Date.now().toString());
        }

        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
      }

      setLoading(false);
      return { success: true };
    } catch (err: any) {
      setLoading(false);
      if (err?.name === "NotAllowedError") {
        return { success: false, error: "Face ID / vingerafdruk geannuleerd of niet beschikbaar. Heb je al een passkey geregistreerd via Mijn Account?" };
      }
      console.error("Passkey auth error:", err?.name, err?.message);
      return { success: false, error: "Inloggen mislukt. Probeer het opnieuw." };
    }
  }, []);

  return {
    available,
    hasPasskey,
    loading,
    checking,
    registerPasskey,
    authenticateWithPasskey,
    checkUserPasskeys,
  };
}
