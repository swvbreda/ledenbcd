import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { NativeBiometric, BiometryType } from "capacitor-native-biometric";
import { supabase } from "@/integrations/supabase/client";

const BIOMETRIC_SERVER = "leden.coffeeshopbond.nl";

interface BiometricState {
  /** Biometric hardware is available on this device */
  isAvailable: boolean;
  /** There are saved credentials we can use */
  hasCredentials: boolean;
  /** Type of biometry (faceId, touchId, etc.) */
  biometryType: BiometryType;
  /** Human-readable label for the biometry type */
  biometryLabel: string;
}

/**
 * Hook for native biometric authentication (Face ID / fingerprint).
 * Only works on native Capacitor platforms (iOS/Android).
 * On web, everything is a no-op.
 */
export function useBiometricAuth() {
  const isNative = Capacitor.isNativePlatform();

  const [state, setState] = useState<BiometricState>({
    isAvailable: false,
    hasCredentials: false,
    biometryType: BiometryType.NONE,
    biometryLabel: "",
  });
  const [loading, setLoading] = useState(false);

  // Check availability and stored credentials on mount
  useEffect(() => {
    if (!isNative) return;

    (async () => {
      try {
        const result = await NativeBiometric.isAvailable();
        const biometryType = result.biometryType;
        const label = biometryType === BiometryType.FACE_ID
          ? "Face ID"
          : biometryType === BiometryType.TOUCH_ID
          ? "Touch ID"
          : biometryType === BiometryType.FINGERPRINT
          ? "Vingerafdruk"
          : biometryType === BiometryType.FACE_AUTHENTICATION
          ? "Gezichtsherkenning"
          : biometryType === BiometryType.IRIS_AUTHENTICATION
          ? "Iris"
          : "Biometrisch";

        let hasCredentials = false;
        try {
          const creds = await NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER });
          hasCredentials = !!(creds?.username && creds?.password);
        } catch {
          // No credentials stored yet
        }

        setState({
          isAvailable: result.isAvailable,
          hasCredentials,
          biometryType,
          biometryLabel: label,
        });
      } catch {
        // Biometric not available
      }
    })();
  }, [isNative]);

  /**
   * Save login credentials for biometric unlock.
   * Call after a successful password login.
   */
  const saveCredentials = useCallback(async (email: string, password: string) => {
    if (!isNative) return;
    try {
      await NativeBiometric.setCredentials({
        username: email,
        password,
        server: BIOMETRIC_SERVER,
      });
      setState((prev) => ({ ...prev, hasCredentials: true }));
    } catch (err) {
      console.error("Failed to save biometric credentials:", err);
    }
  }, [isNative]);

  /**
   * Perform biometric verification and log in with stored credentials.
   * Returns true on success, false on failure.
   */
  const loginWithBiometric = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!isNative) return { success: false, error: "Niet beschikbaar" };
    setLoading(true);
    try {
      // Prompt biometric verification
      await NativeBiometric.verifyIdentity({
        reason: "Log in met " + state.biometryLabel,
        title: "Inloggen",
        subtitle: "Verifieer je identiteit",
      });

      // Retrieve stored credentials
      const credentials = await NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER });
      if (!credentials?.username || !credentials?.password) {
        setLoading(false);
        return { success: false, error: "Geen opgeslagen inloggegevens gevonden" };
      }

      // Sign in with Supabase
      const { error } = await supabase.auth.signInWithPassword({
        email: credentials.username,
        password: credentials.password,
      });

      setLoading(false);
      if (error) {
        // If password changed, clear stored credentials
        if (error.message === "Invalid login credentials") {
          await deleteCredentials();
          return { success: false, error: "Opgeslagen wachtwoord is niet meer geldig. Log opnieuw in met je wachtwoord." };
        }
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      setLoading(false);
      // User cancelled biometric prompt
      if (err?.message?.includes("cancel") || err?.code === "10") {
        return { success: false };
      }
      return { success: false, error: "Biometrische verificatie mislukt" };
    }
  }, [isNative, state.biometryLabel]);

  /**
   * Remove stored credentials (e.g. on logout).
   */
  const deleteCredentials = useCallback(async () => {
    if (!isNative) return;
    try {
      await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER });
      setState((prev) => ({ ...prev, hasCredentials: false }));
    } catch {
      // Ignore
    }
  }, [isNative]);

  return {
    ...state,
    isNative,
    loading,
    saveCredentials,
    loginWithBiometric,
    deleteCredentials,
  };
}
