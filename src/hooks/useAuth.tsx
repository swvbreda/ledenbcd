import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

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

  const checkRoleAndProfile = async (userId: string) => {
    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!roleData);

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
        checkRoleAndProfile(session.user.id).finally(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setIsAdmin(false);
        setLinkedMemberIds([]);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await checkRoleAndProfile(session.user.id);
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
    <AuthContext.Provider value={{ user, session, loading, isAdmin, linkedMemberId, linkedMemberIds, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
