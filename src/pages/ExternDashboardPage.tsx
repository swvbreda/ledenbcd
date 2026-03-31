import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Building2, LogOut, ShieldCheck, ShieldX, Users } from "lucide-react";
import bcdLogo from "@/assets/bcd-logo.png";

interface OrgInfo {
  id: string;
  name: string;
  type: string;
  approved: boolean;
}

interface MemberBasic {
  id: number;
  naam: string;
  coffeeshop: string;
  plaats: string;
  lid_sinds: number | null;
  has_consent: boolean;
  // Extended fields (only when consent given)
  adres?: string;
  postcode?: string;
  kvk?: string;
  email?: string;
  telefoon?: string;
}

const ExternDashboardPage = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [members, setMembers] = useState<MemberBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExtern, setIsExtern] = useState(false);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      // Check if user has extern role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "extern")
        .maybeSingle();

      if (!roleData) {
        setIsExtern(false);
        setLoading(false);
        return;
      }
      setIsExtern(true);

      // Get org info
      const { data: orgUserData } = await supabase
        .from("external_org_users")
        .select("org_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!orgUserData) {
        setLoading(false);
        return;
      }

      const { data: orgData } = await supabase
        .from("external_organizations")
        .select("id, name, type, approved")
        .eq("id", orgUserData.org_id)
        .single();

      if (orgData) {
        setOrg(orgData);

        if (orgData.approved) {
          // Fetch members with consent info
          await loadMembers(orgData.id);
        }
      }
      setLoading(false);
    };

    load();
  }, [user]);

  const loadMembers = async (orgId: string) => {
    // Get all consents for this org
    const { data: consents } = await supabase
      .from("member_data_consents")
      .select("member_id")
      .eq("org_id", orgId)
      .is("revoked_at", null);

    const consentedIds = new Set(consents?.map(c => c.member_id) ?? []);

    // Fetch all active members
    const { data: membersData } = await supabase
      .from("members_data")
      .select("id, data")
      .eq("member_type", "member");

    if (!membersData) return;

    const mapped: MemberBasic[] = membersData.map(m => {
      const d = m.data as any;
      const hasConsent = consentedIds.has(m.id);

      const base: MemberBasic = {
        id: m.id,
        naam: d["Naam"] || d["naam"] || "-",
        coffeeshop: d["Coffeeshop"] || d["coffeeshop"] || "-",
        plaats: d["Plaats"] || d["plaats"] || "-",
        lid_sinds: d["Lid sinds"] || d["lid_sinds"] || null,
        has_consent: hasConsent,
      };

      if (hasConsent) {
        base.adres = d["Adres"] || d["adres"];
        base.postcode = d["Postcode"] || d["postcode"];
        base.kvk = d["KvK"] || d["kvk"];
        base.email = d["Email"] || d["email"] || d["E-mail"];
        base.telefoon = d["Telefoon"] || d["telefoon"];
      }

      return base;
    });

    mapped.sort((a, b) => a.naam.localeCompare(b.naam));
    setMembers(mapped);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Laden...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/extern-login" replace />;
  if (!isExtern) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card px-6 h-14">
        <div className="flex items-center gap-3">
          <img src={bcdLogo} alt="BCD" className="h-8 w-auto" />
          <h1 className="text-sm font-semibold font-display text-foreground">Extern Portaal</h1>
        </div>
        <div className="flex items-center gap-3">
          {org && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 size={14} /> {org.name}
            </span>
          )}
          <button
            onClick={signOut}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <LogOut size={14} /> Uitloggen
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-6 space-y-6">
        {!org ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground">Geen organisatie gekoppeld aan uw account.</p>
          </div>
        ) : !org.approved ? (
          <div className="text-center py-16 space-y-3">
            <ShieldX size={48} className="mx-auto text-muted-foreground" />
            <h2 className="text-lg font-semibold">Account in behandeling</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Uw registratie wordt beoordeeld door het bestuur van de Bond van Cannabis Detaillisten. 
              U ontvangt bericht zodra uw account is goedgekeurd.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users size={16} />
              <span>{members.length} leden gevonden</span>
              <span className="text-xs">•</span>
              <span className="flex items-center gap-1">
                <ShieldCheck size={14} className="text-green-500" />
                {members.filter(m => m.has_consent).length} met toestemming
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Naam</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Coffeeshop</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plaats</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Lid sinds</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Toestemming</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contactgegevens</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(m => (
                    <tr key={m.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">{m.naam}</td>
                      <td className="px-4 py-3">{m.coffeeshop}</td>
                      <td className="px-4 py-3">{m.plaats}</td>
                      <td className="px-4 py-3">{m.lid_sinds || "-"}</td>
                      <td className="px-4 py-3">
                        {m.has_consent ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                            <ShieldCheck size={14} /> Ja
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Nee</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {m.has_consent ? (
                          <div className="space-y-0.5">
                            {m.email && <div>{m.email}</div>}
                            {m.telefoon && <div>{m.telefoon}</div>}
                            {m.adres && <div>{m.adres}</div>}
                            {m.postcode && m.plaats && <div>{m.postcode} {m.plaats}</div>}
                            {m.kvk && <div>KvK: {m.kvk}</div>}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Geen toestemming</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default ExternDashboardPage;
