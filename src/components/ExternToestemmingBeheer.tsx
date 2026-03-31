import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ShieldCheck, ShieldX, Building2 } from "lucide-react";
import { toast } from "sonner";

interface OrgConsent {
  org_id: string;
  org_name: string;
  org_type: string;
  has_consent: boolean;
}

const ExternToestemmingBeheer = () => {
  const { user, linkedMemberIds } = useAuth();
  const [orgs, setOrgs] = useState<OrgConsent[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const memberId = linkedMemberIds[0] ?? null;

  useEffect(() => {
    if (!user || !memberId) {
      setLoading(false);
      return;
    }
    loadOrgs();
  }, [user, memberId]);

  const loadOrgs = async () => {
    // Get approved external orgs
    const { data: orgData } = await supabase
      .from("external_organizations")
      .select("id, name, type")
      .eq("approved", true);

    if (!orgData || orgData.length === 0) {
      setOrgs([]);
      setLoading(false);
      return;
    }

    // Get existing consents for this member
    const { data: consents } = await supabase
      .from("member_data_consents")
      .select("org_id, revoked_at")
      .eq("member_id", memberId!);

    const consentMap = new Map(
      consents?.map(c => [c.org_id, !c.revoked_at]) ?? []
    );

    setOrgs(
      orgData.map(o => ({
        org_id: o.id,
        org_name: o.name,
        org_type: o.type,
        has_consent: consentMap.get(o.id) ?? false,
      }))
    );
    setLoading(false);
  };

  const toggleConsent = async (orgId: string, grant: boolean) => {
    if (!user || !memberId) return;
    setToggling(orgId);

    if (grant) {
      // Upsert consent
      const { error } = await supabase
        .from("member_data_consents")
        .upsert({
          member_id: memberId,
          org_id: orgId,
          granted_by: user.id,
          granted_at: new Date().toISOString(),
          revoked_at: null,
        }, { onConflict: "member_id,org_id" });

      if (error) {
        console.error(error);
        toast.error("Fout bij verlenen toestemming");
      } else {
        toast.success("Toestemming verleend");
      }
    } else {
      // Revoke consent
      const { error } = await supabase
        .from("member_data_consents")
        .update({ revoked_at: new Date().toISOString() })
        .eq("member_id", memberId)
        .eq("org_id", orgId);

      if (error) {
        console.error(error);
        toast.error("Fout bij intrekken toestemming");
      } else {
        toast.success("Toestemming ingetrokken");
      }
    }

    await loadOrgs();
    setToggling(null);
  };

  if (loading) return <p className="text-sm text-muted-foreground">Laden...</p>;
  if (!memberId) return null;
  if (orgs.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Gegevensdeling met externe partijen</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Bepaal per organisatie of zij uw uitgebreide gegevens (adres, KvK, contactgegevens) mogen inzien. 
          Basisinformatie (naam, coffeeshop, lid sinds) is altijd zichtbaar.
        </p>
      </div>

      <div className="space-y-2">
        {orgs.map(o => (
          <div key={o.org_id} className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-3">
              <Building2 size={16} className="text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{o.org_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{o.org_type}</p>
              </div>
            </div>
            <button
              onClick={() => toggleConsent(o.org_id, !o.has_consent)}
              disabled={toggling === o.org_id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                o.has_consent
                  ? "bg-green-500/10 text-green-600 hover:bg-red-500/10 hover:text-red-600"
                  : "bg-muted text-muted-foreground hover:bg-green-500/10 hover:text-green-600"
              } disabled:opacity-50`}
            >
              {o.has_consent ? (
                <>
                  <ShieldCheck size={14} />
                  Toestemming verleend
                </>
              ) : (
                <>
                  <ShieldX size={14} />
                  Geen toestemming
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExternToestemmingBeheer;
