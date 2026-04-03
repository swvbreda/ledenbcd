import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useNavigate } from "react-router-dom";
import { Building2, Check, X, Clock, Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const ORG_TYPES = [
  { value: "bank", label: "Bank" },
  { value: "overheid", label: "Overheid" },
  { value: "leverancier", label: "Leverancier / Aanbieder" },
  { value: "anders", label: "Anders" },
];

export default function ExternePartijenPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [orgs, setOrgs] = useState<ExternalOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOrg, setEditOrg] = useState<ExternalOrg | null>(null);
  const [editForm, setEditForm] = useState({ name: "", type: "", contact_name: "", contact_email: "", notes: "" });
  const [saving, setSaving] = useState(false);

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

  const syncSupplierBenefits = async (orgId: string) => {
    const { data, error } = await supabase.functions.invoke("manage-users", {
      body: { action: "sync_supplier_benefits", org_id: orgId },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return Number(data?.linked_count ?? 0);
  };

  const handleApprove = async (orgId: string) => {
    const { error } = await supabase
      .from("external_organizations")
      .update({ approved: true, approved_by: user!.id, approved_at: new Date().toISOString() })
      .eq("id", orgId);

    if (error) {
      toast.error("Fout bij goedkeuren: " + error.message);
    } else {
      try {
        const linkedCount = await syncSupplierBenefits(orgId);
        toast.success(
          linkedCount > 0
            ? `Organisatie goedgekeurd en ${linkedCount} product(en) gekoppeld`
            : "Organisatie goedgekeurd"
        );
      } catch (syncError: any) {
        toast.error("Organisatie goedgekeurd, maar automatische productkoppeling mislukte");
        console.error("Supplier sync failed after approve:", syncError);
      }
      loadOrgs();
    }
  };

  const handleReject = async (orgId: string) => {
    if (!confirm("Weet je zeker dat je deze organisatie wilt verwijderen?")) return;
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

  const openEdit = (org: ExternalOrg) => {
    setEditOrg(org);
    setEditForm({
      name: org.name,
      type: org.type,
      contact_name: org.contact_name || "",
      contact_email: org.contact_email || "",
      notes: org.notes || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editOrg) return;
    setSaving(true);
    const { error } = await supabase
      .from("external_organizations")
      .update({
        name: editForm.name.trim(),
        type: editForm.type,
        contact_name: editForm.contact_name.trim() || null,
        contact_email: editForm.contact_email.trim() || null,
        notes: editForm.notes.trim() || null,
      })
      .eq("id", editOrg.id);

    if (error) {
      toast.error("Fout bij opslaan: " + error.message);
    } else {
      try {
        const linkedCount = await syncSupplierBenefits(editOrg.id);
        toast.success(
          linkedCount > 0
            ? `Organisatie bijgewerkt en ${linkedCount} product(en) gekoppeld`
            : "Organisatie bijgewerkt"
        );
      } catch (syncError: any) {
        toast.error("Organisatie bijgewerkt, maar automatische productkoppeling mislukte");
        console.error("Supplier sync failed after edit:", syncError);
      }
      setEditOrg(null);
      loadOrgs();
    }
    setSaving(false);
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

  const typeLabel = (type: string) => ORG_TYPES.find(t => t.value === type)?.label || type;

  const OrgCard = ({ org, actions }: { org: ExternalOrg; actions: React.ReactNode }) => (
    <Card key={org.id} className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Building2 size={14} className="text-muted-foreground shrink-0" />
            <span className="font-semibold text-sm">{org.name}</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{typeLabel(org.type)}</span>
          </div>
          {org.contact_name && <p className="text-xs text-muted-foreground">Contactpersoon: {org.contact_name}</p>}
          {org.contact_email && <p className="text-xs text-muted-foreground">{org.contact_email}</p>}
          {org.notes && <p className="text-xs text-muted-foreground italic">{org.notes}</p>}
          <p className="text-xs text-muted-foreground">Aangemeld: {new Date(org.created_at).toLocaleDateString("nl-NL")}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      </div>
    </Card>
  );

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
            <OrgCard
              key={org.id}
              org={org}
              actions={
                <>
                  <Button size="sm" variant="ghost" className="gap-1 h-8 w-8 p-0" onClick={() => openEdit(org)}>
                    <Pencil size={14} />
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => handleReject(org.id)}>
                    <X size={14} /> Afwijzen
                  </Button>
                  <Button size="sm" className="gap-1" onClick={() => handleApprove(org.id)}>
                    <Check size={14} /> Goedkeuren
                  </Button>
                </>
              }
            />
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
            <OrgCard
              key={org.id}
              org={org}
              actions={
                <>
                  <Button size="sm" variant="ghost" className="gap-1 h-8 w-8 p-0" onClick={() => openEdit(org)}>
                    <Pencil size={14} />
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => handleReject(org.id)}>
                    <X size={14} /> Verwijderen
                  </Button>
                </>
              }
            />
          ))
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editOrg} onOpenChange={(o) => { if (!o) setEditOrg(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Organisatie bewerken</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label>Naam</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={editForm.type} onValueChange={(v) => setEditForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORG_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Contactpersoon</Label>
              <Input value={editForm.contact_name} onChange={(e) => setEditForm(f => ({ ...f, contact_name: e.target.value }))} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={editForm.contact_email} onChange={(e) => setEditForm(f => ({ ...f, contact_email: e.target.value }))} />
            </div>
            <div>
              <Label>Notities</Label>
              <Textarea value={editForm.notes} onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
            <Button onClick={handleSaveEdit} disabled={saving || !editForm.name.trim()} className="w-full gap-1">
              <Save size={14} /> {saving ? "Opslaan..." : "Opslaan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
