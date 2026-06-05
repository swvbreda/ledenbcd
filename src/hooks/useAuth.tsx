import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { SESSION_EXPIRED_EVENT_NAME } from "@/lib/invokeFunction";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isExtern: boolean;
  isInhuur: boolean;
  linkedMemberId: number | null;
  linkedMemberIds: number[];
  mfaStatus: "verified" | "needs_verify" | "needs_setup" | "loading";
  /** Mark email-based MFA as verified for this session */
  markEmailMfaVerified: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  isExtern: false,
  isInhuur: false,
  linkedMemberId: null,
  linkedMemberIds: [],
  mfaStatus: "loading",
  markEmailMfaVerified: () => {},
  signOut: async () => {},
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isExtern, setIsExtern] = useState(false);
  const [linkedMemberIds, setLinkedMemberIds] = useState<number[]>([]);
  const [mfaStatus, setMfaStatus] = useState<"verified" | "needs_verify" | "needs_setup" | "loading">("loading");

  const markEmailMfaVerified = useCallback(() => {
    if (user?.id) {
      localStorage.setItem(`${EMAIL_MFA_KEY_PREFIX}${user.id}`, Date.now().toString());
      setMfaStatus("verified");
    }
  }, [user?.id]);

  const checkMfaStatus = async (userId: string) => {
    // Check email MFA flag first
    if (checkEmailMfaFlag(userId)) {
      setMfaStatus("verified");
      return;
    }

    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) {
      setMfaStatus("verified"); // fallback: don't block
      return;
    }
    const { currentLevel, nextLevel } = data;
    if (nextLevel === "aal2" && currentLevel === "aal1") {
      setMfaStatus("needs_verify");
    } else if (nextLevel === "aal1" && currentLevel === "aal1") {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasVerifiedTotp = factors?.totp?.some(f => f.status === "verified");
      if (hasVerifiedTotp) {
        setMfaStatus("needs_verify");
      } else {
        setMfaStatus("needs_setup");
      }
    } else {
      setMfaStatus("verified");
    }
  };

  const checkRoleAndProfile = async (userId: string) => {
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    
    const roles = roleData?.map(r => r.role) ?? [];
    setIsAdmin(roles.includes("admin"));
    setIsExtern(roles.includes("extern"));

    const { data: profileData } = await supabase
      .from("member_profiles")
      .select("member_id")
      .eq("user_id", userId);
    setLinkedMemberIds(profileData?.map((p) => p.member_id) ?? []);
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        promotePendingPasskeyMfaFlag(session.user.id);
        // Check email MFA flag synchronously to avoid unnecessary async MFA calls
        const emailMfaOk = checkEmailMfaFlag(session.user.id);
        if (emailMfaOk) {
          setMfaStatus("verified");
        }
        Promise.all([
          checkRoleAndProfile(session.user.id),
          ...(emailMfaOk ? [] : [checkMfaStatus(session.user.id)]),
        ]).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setIsAdmin(false);
        setIsExtern(false);
        setLinkedMemberIds([]);
        setMfaStatus("loading");
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        promotePendingPasskeyMfaFlag(session.user.id);
        await Promise.all([
          checkRoleAndProfile(session.user.id),
          checkMfaStatus(session.user.id),
        ]);
      }
      if (mounted) setLoading(false);
    });

    // "Onthoud mij" — clear session when browser closes if disabled
    const handleBeforeUnload = () => {
      try {
        if (localStorage.getItem("remember_me") === "false") {
          // Remove Supabase session tokens so next visit requires login
          const storageKey = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
          if (storageKey) localStorage.removeItem(storageKey);
        }
      } catch {}
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Global handler: when invokeWithAuth detects an unrecoverable auth failure,
    // sign the user out and send them to the login page with a single toast.
    const handleSessionExpired = async () => {
      try {
        if (user?.id) {
          try { localStorage.removeItem(`${EMAIL_MFA_KEY_PREFIX}${user.id}`); } catch {}
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
      subscription.unsubscribe();
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener(SESSION_EXPIRED_EVENT_NAME, handleSessionExpired);
    };
  }, []);

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
    <AuthContext.Provider value={{ user, session, loading, isAdmin, isExtern, isInhuur, linkedMemberId, linkedMemberIds, mfaStatus, markEmailMfaVerified, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
