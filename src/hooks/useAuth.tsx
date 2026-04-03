import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session, AuthenticatorAssuranceLevels } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  isExtern: boolean;
  /** The first member_id linked to the current user (null if none) */
  linkedMemberId: number | null;
  /** All member_ids linked to the current user */
  linkedMemberIds: number[];
  /** MFA status: whether the user needs to verify or enroll */
  mfaStatus: "verified" | "needs_verify" | "needs_setup" | "loading";
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  isExtern: false,
  linkedMemberId: null,
  linkedMemberIds: [],
  mfaStatus: "loading",
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isExtern, setIsExtern] = useState(false);
  const [linkedMemberIds, setLinkedMemberIds] = useState<number[]>([]);
  const [mfaStatus, setMfaStatus] = useState<"verified" | "needs_verify" | "needs_setup" | "loading">("loading");

  const checkMfaStatus = async () => {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) {
      setMfaStatus("verified"); // fallback: don't block
      return;
    }
    const { currentLevel, nextLevel } = data as AuthenticatorAssuranceLevels;
    if (nextLevel === "aal2" && currentLevel === "aal1") {
      // Has enrolled factor but hasn't verified yet this session
      setMfaStatus("needs_verify");
    } else if (nextLevel === "aal1" && currentLevel === "aal1") {
      // No factor enrolled
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasVerifiedTotp = factors?.totp?.some(f => f.status === "verified");
      if (hasVerifiedTotp) {
        // Factor exists but session is aal1 → needs verify
        setMfaStatus("needs_verify");
      } else {
        setMfaStatus("needs_setup");
      }
    } else {
      // aal2 — fully verified
      setMfaStatus("verified");
    }
  };

  const checkRoleAndProfile = async (userId: string) => {
    // Check roles
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    
    const roles = roleData?.map(r => r.role) ?? [];
    setIsAdmin(roles.includes("admin"));
    setIsExtern(roles.includes("extern"));

    // Check member profile links (multiple)
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
        Promise.all([
          checkRoleAndProfile(session.user.id),
          checkMfaStatus(),
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
        await Promise.all([
          checkRoleAndProfile(session.user.id),
          checkMfaStatus(),
        ]);
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const linkedMemberId = linkedMemberIds[0] ?? null;

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, isExtern, linkedMemberId, linkedMemberIds, mfaStatus, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
