import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { SESSION_EXPIRED_EVENT_NAME, handleRpcAuthError } from "@/lib/invokeFunction";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { memberPasswordlessEnabled } from "@/lib/memberAccessFlag";
import { fetchRolesWithSessionRecovery, withAuthTimeout } from "@/lib/authAccess";
import {
  createAccessController,
  deriveAccess,
  IDLE_ACCESS,
  singleFlight,
  type AccessSnapshot,
  type AccessState,
} from "@/lib/accessController";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isExtern: boolean;
  isInhuur: boolean;
  isBoard: boolean;
  isReviewer: boolean;
  linkedMemberId: number | null;
  linkedMemberIds: number[];
  mfaStatus: "verified" | "needs_verify" | "needs_setup" | "loading";
  /** Mark email-based MFA as verified for this session */
  markEmailMfaVerified: () => void;
  signOut: () => Promise<void>;
  /** Set when session/rights could not be verified (timeout or backend error). Access is denied while set. */
  authError: string | null;
  retryAuth: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  isExtern: false,
  isInhuur: false,
  isBoard: false,
  isReviewer: false,
  linkedMemberId: null,
  linkedMemberIds: [],
  mfaStatus: "loading",
  markEmailMfaVerified: () => {},
  signOut: async () => {},
  authError: null,
  retryAuth: () => {},
});

export const useAuth = () => useContext(AuthContext);

const EMAIL_MFA_KEY_PREFIX = "emfa_";
const PASSKEY_MFA_PENDING_KEY = "passkey_mfa_pending";

function checkEmailMfaFlag(userId: string): boolean {
  try {
    const stored = localStorage.getItem(`${EMAIL_MFA_KEY_PREFIX}${userId}`);
    if (!stored) return false;
    const timestamp = parseInt(stored, 10);
    // Valid for 30 days — keeps leden ingelogd zonder telkens opnieuw MFA
    return Date.now() - timestamp < 30 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function checkPendingPasskeyMfaFlag(): boolean {
  try {
    const stored = localStorage.getItem(PASSKEY_MFA_PENDING_KEY);
    if (!stored) return false;
    const timestamp = parseInt(stored, 10);
    return Date.now() - timestamp < 5 * 60 * 1000;
  } catch {
    return false;
  }
}

function promotePendingPasskeyMfaFlag(userId: string): boolean {
  if (!checkPendingPasskeyMfaFlag()) return false;

  try {
    localStorage.setItem(`${EMAIL_MFA_KEY_PREFIX}${userId}`, Date.now().toString());
    localStorage.removeItem(PASSKEY_MFA_PENDING_KEY);
    return true;
  } catch {
    return false;
  }
}

// Gedeeld over de hele app: twee gelijktijdige refreshSession-aanroepen met hetzelfde
// refresh token leveren "refresh_token_already_used" op en kunnen de sessie intrekken.
const refreshSessionOnce = singleFlight(() => supabase.auth.refreshSession());

const ACCESS_TIMEOUT_MS = 20_000;
const SESSION_TIMEOUT_MS = 15_000;

async function loadAccessSnapshot(userId: string): Promise<AccessSnapshot> {
  const roles = await fetchRolesWithSessionRecovery({
    expectedUserId: userId,
    getAuthenticatedUserId: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.id ?? null;
    },
    fetchRoles: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;
      return data?.map((row) => row.role) ?? [];
    },
    refreshSession: async () => {
      const { data, error } = await refreshSessionOnce();
      if (error) throw error;
      if (data.session?.user.id !== userId) {
        throw new Error("De vernieuwde sessie hoort niet bij de ingelogde gebruiker");
      }
    },
  });

  // Ledenkoppeling (eerst herstellen, dan lezen) en bestuursregels parallel ophalen;
  // alles wordt pas als één geheel toegepast, nooit half.
  const memberIdsPromise = (async () => {
    try {
      const { error: linkError } = await (supabase as any).rpc("ensure_member_link");
      if (linkError && handleRpcAuthError(linkError)) {
        throw new Error("Sessie verlopen tijdens het laden van de ledenkoppeling");
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Sessie verlopen")) throw e;
      console.warn("ensure_member_link mislukt", e);
    }
    if (memberPasswordlessEnabled) {
      const { data } = await (supabase as any).rpc("current_member_id");
      return typeof data === "number" ? [data] : [];
    }
    const { data } = await supabase.from("member_profiles").select("member_id").eq("user_id", userId);
    return data?.map((p) => p.member_id) ?? [];
  })();
  const boardRowsPromise = supabase.from("board_members").select("lid_id, lid_ids").then((r) => r.data ?? []);

  const [memberIds, boardRows] = await Promise.all([memberIdsPromise, boardRowsPromise]);
  const isBoard =
    memberIds.length > 0 &&
    (boardRows as any[]).some((row) => {
      if (row?.lid_id && memberIds.includes(row.lid_id)) return true;
      const ids: number[] = Array.isArray(row?.lid_ids) ? row.lid_ids : [];
      return ids.some((id) => memberIds.includes(id));
    });
  return { roles, memberIds, isBoard };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionPending, setSessionPending] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [accessState, setAccessState] = useState<AccessState>(IDLE_ACCESS);
  const [isReviewer, setIsReviewer] = useState(false);
  const [mfaStatus, setMfaStatus] = useState<"verified" | "needs_verify" | "needs_setup" | "loading">("loading");
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  const markEmailMfaVerified = useCallback(() => {
    if (user?.id) {
      localStorage.setItem(`${EMAIL_MFA_KEY_PREFIX}${user.id}`, Date.now().toString());
      setMfaStatus("verified");
    }
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;
    let sessionResolved = false;

    const controller = createAccessController({
      load: loadAccessSnapshot,
      timeoutMs: ACCESS_TIMEOUT_MS,
      timeoutLabel: "Het laden van gebruikersrechten",
      onChange: (next) => {
        if (!mounted) return;
        if (next.status === "error") console.error("Gebruikersrechten laden mislukt", next.message);
        setAccessState(next);
      },
      onBackgroundError: (e) => console.error("Gebruikersrechten verversen mislukt", e),
    });

    const applySession = (nextSession: Session | null) => {
      sessionResolved = true;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setSessionPending(false);
      setSessionError(null);
      const sessionUser = nextSession?.user ?? null;
      setIsReviewer(!!sessionUser?.user_metadata?.is_reviewer);
      if (sessionUser) {
        promotePendingPasskeyMfaFlag(sessionUser.id);
        // Dubbele verificatie is uitgeschakeld voor het ledenportaal: een geldige sessie volstaat.
        setMfaStatus("verified");
        // Overige clientaanroepen buiten de auth-callback uitvoeren (Supabase-advies).
        const id = sessionUser.id;
        window.setTimeout(() => {
          if (mounted) void controller.ensure(id);
        }, 0);
      } else {
        setMfaStatus("loading");
        controller.reset();
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      applySession(nextSession);
    });

    void withAuthTimeout(supabase.auth.getSession(), SESSION_TIMEOUT_MS, "De inlogservice")
      .then(({ data, error }) => {
        if (!mounted || sessionResolved) return; // de listener was eerder en is leidend
        if (error) throw error;
        applySession(data.session);
      })
      .catch((error) => {
        if (!mounted || sessionResolved) return;
        console.error("Auth bootstrap mislukt", error);
        // Geen rechten toekennen zolang niet geverifieerd.
        controller.reset();
        setSessionPending(false);
        setSessionError(error instanceof Error ? error.message : "Onbekende fout bij inloggen");
      });

    // "Onthoud mij" — clear session when browser closes if disabled
    const handleBeforeUnload = () => {
      try {
        // In de native telefoonapp blijft de Supabase-sessie altijd bewaard.
        if (Capacitor.isNativePlatform()) return;
        if (localStorage.getItem("remember_me") === "false") {
          // Remove Supabase session tokens so next visit requires login
          const storageKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
          if (storageKey) localStorage.removeItem(storageKey);
        }
      } catch {}
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Een iOS/Android WebView kan lang in het geheugen blijven staan. Bij het
    // terugkeren naar de app verversen we de sessie en rechten; na een langere
    // achtergrondperiode laden we ook de actuele live webversie opnieuw.
    let backgroundedAt: number | null = null;
    let appStateHandle: { remove: () => Promise<void> } | undefined;
    if (Capacitor.isNativePlatform()) {
      void import("@capacitor/app")
        .then(({ App }) =>
          App.addListener("appStateChange", ({ isActive }) => {
            if (!isActive) {
              backgroundedAt = Date.now();
              return;
            }

            if (backgroundedAt && Date.now() - backgroundedAt > 5 * 60_000) {
              // Alleen volledig herladen als er geen onopgeslagen invoer is,
              // zodat een half ingevuld formulier of bericht niet verloren gaat.
              const hasUnsavedInput = Array.from(
                document.querySelectorAll("input, textarea"),
              ).some((el) => {
                if (el instanceof HTMLTextAreaElement) return el.value !== el.defaultValue;
                if (el instanceof HTMLInputElement)
                  return el.type !== "password" && el.value !== el.defaultValue;
                return false;
              });
              if (!hasUnsavedInput) {
                window.location.reload();
                return;
              }
            }
            backgroundedAt = null;

            void refreshSessionOnce().then(({ data, error }) => {
              if (error || !data.session?.user || !mounted) return;
              // Herbeoordeling op de achtergrond: geverifieerde rechten blijven staan tot er nieuwe zijn.
              void controller.ensure(data.session.user.id, { force: true });
            });
          }),
        )
        .then((handle) => {
          appStateHandle = handle;
        });
    }

    // Global handler: when invokeWithAuth detects an unrecoverable auth failure,
    // sign the user out and send them to the login page with a single toast.
    const handleSessionExpired = async () => {
      try {
        const currentUserId = userIdRef.current;
        if (currentUserId) {
          try { localStorage.removeItem(`${EMAIL_MFA_KEY_PREFIX}${currentUserId}`); } catch {}
        }
        try { localStorage.removeItem(PASSKEY_MFA_PENDING_KEY); } catch {}
        await supabase.auth.signOut();
      } catch {}

      const path = window.location.pathname;
      const isAuthRoute =
        path.startsWith("/login") ||
        path.startsWith("/extern-login") ||
        path.startsWith("/reset-password") ||
        path.startsWith("/mfa-");
      if (isAuthRoute) return;

      toast.error("Sessie verlopen. Log opnieuw in.");
      const target = path.startsWith("/extern") ? "/extern-login" : "/login";
      window.location.assign(target);
    };
    window.addEventListener(SESSION_EXPIRED_EVENT_NAME, handleSessionExpired);

    return () => {
      mounted = false;
      controller.dispose();
      subscription.unsubscribe();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener(SESSION_EXPIRED_EVENT_NAME, handleSessionExpired);
      void appStateHandle?.remove();
    };
  }, [bootstrapAttempt]);

  const retryAuth = useCallback(() => {
    setSessionError(null);
    setSessionPending(true);
    setAccessState(IDLE_ACCESS);
    setBootstrapAttempt((n) => n + 1);
  }, []);

  const derived = deriveAccess({ sessionPending, userId: user?.id ?? null, access: accessState });
  const { loading, isAdmin, isExtern, isBoard, linkedMemberIds } = derived;
  const authError = sessionError ?? derived.accessError;

  const signOut = async () => {
    if (user?.id) {
      try { localStorage.removeItem(`${EMAIL_MFA_KEY_PREFIX}${user.id}`); } catch {}
    }
    try { localStorage.removeItem(PASSKEY_MFA_PENDING_KEY); } catch {}
    await supabase.auth.signOut();
  };

  const linkedMemberId = linkedMemberIds[0] ?? null;
  const isInhuur = !isAdmin && !isExtern && !!user && linkedMemberIds.length === 0;

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, isExtern, isInhuur, isBoard, isReviewer, linkedMemberId, linkedMemberIds, mfaStatus, markEmailMfaVerified, signOut, authError, retryAuth }}>
      {children}
    </AuthContext.Provider>
  );
};
