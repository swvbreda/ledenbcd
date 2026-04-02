import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Building2, Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

interface ExternalOrg {
  id: string;
  name: string;
  type: string;
  contact_email: string | null;
  contact_name: string | null;
  approved: boolean;
  approved_at: string | null;
  created_at: string;
  notes: string | null;
}

export default function ExternePartijenPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [orgs, setOrgs] = useState<ExternalOrg[]>([]);
  const [loading, setLoading] = useState(true);

  const loadOrgs = async () => {
    const { data } = await supabase
      .from("external_organizations")
      .select("*")
      .order("created_at", { ascending: false });
    setOrgs((data as ExternalOrg[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) loadOrgs();
  }, [isAdmin]);

  const handleApprove = async (orgId: string) => {
    const { error } = await supabase
      .from("external_organizations")
      .update({ approved: true, approved_by: user!.id, approved_at: new Date().toISOString() })
      .eq("id", orgId);

    if (error) {
      toast.error("Fout bij goedkeuren: " + error.message);
    } else {
      toast.success("Organisatie goedgekeurd");
      loadOrgs();
    }
  };

  const handleReject = async (orgId: string) => {
    const { error } = await supabase
      .from("external_organizations")
      .delete()
      .eq("id", orgId);

    if (error) {
      toast.error("Fout bij verwijderen: " + error.message);
    } else {
      toast.success("Aanvraag verwijderd");
      loadOrgs();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  const pending = orgs.filter(o => !o.approved);
  const approved = orgs.filter(o => o.approved);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold font-display">Externe Partijen</h2>
        <p className="text-sm text-muted-foreground mt-1">Beheer toegang voor banken, overheden en leveranciers</p>
      </div>

      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Clock size={14} className="text-amber-500" /> Openstaande aanvragen ({pending.length})
          </h3>
          {pending.map(org => (
            <Card key={org.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-muted-foreground" />
                    <span className="font-semibold text-sm">{org.name}</span>
                    <span className="text-xs text-muted-foreground capitalize bg-muted px-2 py-0.5 rounded">{org.type}</span>
                  </div>
                  {org.contact_name && <p className="text-xs text-muted-foreground">Contactpersoon: {org.contact_name}</p>}
                  {org.contact_email && <p className="text-xs text-muted-foreground">{org.contact_email}</p>}
                  <p className="text-xs text-muted-foreground">Aangevraagd: {new Date(org.created_at).toLocaleDateString("nl-NL")}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => handleReject(org.id)}>
                    <X size={14} /> Afwijzen
                  </Button>
                  <Button size="sm" className="gap-1" onClick={() => handleApprove(org.id)}>
                    <Check size={14} /> Goedkeuren
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Building2 size={14} /> Goedgekeurde organisaties ({approved.length})
        </h3>
        {approved.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nog geen goedgekeurde externe partijen.</p>
        ) : (
          approved.map(org => (
            <Card key={org.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 size={14} className="text-muted-foreground" />
                    <span className="font-semibold text-sm">{org.name}</span>
                    <span className="text-xs text-muted-foreground capitalize bg-muted px-2 py-0.5 rounded">{org.type}</span>
                  </div>
                  {org.contact_name && <p className="text-xs text-muted-foreground">Contactpersoon: {org.contact_name}</p>}
                  {org.contact_email && <p className="text-xs text-muted-foreground">{org.contact_email}</p>}
                </div>
                <Button size="sm" variant="outline" className="gap-1 text-destructive shrink-0" onClick={() => handleReject(org.id)}>
                  <X size={14} /> Verwijderen
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
