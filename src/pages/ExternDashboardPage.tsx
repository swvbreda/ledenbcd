import { useEffect, useState, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Building2, LogOut, ShieldCheck, ShieldX, Users, Package, Plus, Pencil, Trash2, Mail, Store, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import bcdLogo from "@/assets/bcd-logo.png";
import BenefitFormDialog from "@/components/BenefitFormDialog";
import type { Benefit } from "@/hooks/useBenefits";
import { getBenefitImageUrl } from "@/hooks/useBenefits";
import type { Member } from "@/data/types";
import SupplierCoffeeshopTable from "@/components/SupplierCoffeeshopTable";
import SupplierGemeentenOverzicht from "@/components/SupplierGemeentenOverzicht";

interface OrgInfo {
  id: string;
  name: string;
  type: string;
  approved: boolean;
  contact_email: string | null;
  contact_name: string | null;
  notes: string | null;
}

interface OrgUser {
  id: string;
  email: string;
  created_at: string;
}

interface MemberBasic {
  id: number;
  naam: string;
  coffeeshop: string;
  plaats: string;
  lid_sinds: number | null;
  has_consent: boolean;
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
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExtern, setIsExtern] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBenefit, setEditBenefit] = useState<Benefit | null>(null);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [orgEditForm, setOrgEditForm] = useState({ contact_name: "", contact_email: "", notes: "" });
  const [savingOrg, setSavingOrg] = useState(false);
  const [supplierTab, setSupplierTab] = useState<"producten" | "coffeeshops" | "gemeenten">("producten");
  const [allMembers, setAllMembers] = useState<Member[]>([]);

  const isSupplier = org?.type === "leverancier";

  useEffect(() => {
    if (!user) return;

    const load = async () => {
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
        .select("id, name, type, approved, contact_email, contact_name, notes")
        .eq("id", orgUserData.org_id)
        .single();

      if (orgData) {
        setOrg(orgData as OrgInfo);

        if (orgData.approved) {
          if (orgData.type === "leverancier") {
            await loadSupplierBenefits(orgData.id);
          } else {
            await loadMembers(orgData.id);
          }
        }
      }
      setLoading(false);
    };

    load();
  }, [user]);

  const loadSupplierBenefits = async (orgId: string) => {
    const { data, error } = await supabase
      .from("member_benefits")
      .select("*")
      .eq("supplier_org_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading benefits:", error);
      return;
    }
    setBenefits((data as unknown as Benefit[]) ?? []);
  };

  const loadMembers = async (orgId: string) => {
    const { data: consents } = await supabase
      .from("member_data_consents")
      .select("member_id")
      .eq("org_id", orgId)
      .is("revoked_at", null);

    const consentedIds = new Set(consents?.map(c => c.member_id) ?? []);

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

  const handleNewBenefit = () => {
    setEditBenefit(null);
    setDialogOpen(true);
  };

  const handleEditBenefit = (b: Benefit) => {
    setEditBenefit(b);
    setDialogOpen(true);
  };

  const handleDeleteBenefit = async (id: string) => {
    if (!confirm("Weet je zeker dat je dit product wilt verwijderen?")) return;
    const { error } = await supabase.from("member_benefits").delete().eq("id", id);
    if (error) {
      toast.error("Fout bij verwijderen: " + error.message);
    } else {
      toast.success("Product verwijderd");
      if (org) loadSupplierBenefits(org.id);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open && org && isSupplier) {
      // Refresh benefits after dialog closes
      loadSupplierBenefits(org.id);
    }
  };

  const handleOpenOrgDialog = async () => {
    if (!org) return;
    setOrgEditForm({
      contact_name: org.contact_name || "",
      contact_email: org.contact_email || "",
      notes: org.notes || "",
    });
    setOrgDialogOpen(true);

    // Load org users
    const { data: orgUserLinks } = await supabase
      .from("external_org_users")
      .select("user_id, created_at")
      .eq("org_id", org.id);

    if (orgUserLinks && orgUserLinks.length > 0) {
      // We need emails from auth - use the user's own email as fallback
      const users: OrgUser[] = orgUserLinks.map(u => ({
        id: u.user_id,
        email: u.user_id === user?.id ? (user?.email || "Onbekend") : "Geregistreerd gebruiker",
        created_at: u.created_at,
      }));
      setOrgUsers(users);
    } else {
      setOrgUsers([]);
    }
  };

  const handleSaveOrg = async () => {
    if (!org) return;
    setSavingOrg(true);
    const { error } = await supabase
      .from("external_organizations")
      .update({
        contact_name: orgEditForm.contact_name.trim() || null,
        contact_email: orgEditForm.contact_email.trim() || null,
        notes: orgEditForm.notes.trim() || null,
      })
      .eq("id", org.id);

    if (error) {
      toast.error("Fout bij opslaan: " + error.message);
    } else {
      toast.success("Organisatie bijgewerkt");
      setOrg({
        ...org,
        contact_name: orgEditForm.contact_name.trim() || null,
        contact_email: orgEditForm.contact_email.trim() || null,
        notes: orgEditForm.notes.trim() || null,
      });
    }
    setSavingOrg(false);
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
          <h1 className="text-sm font-semibold font-display text-foreground">
            {isSupplier ? "Leverancier Portaal" : "Extern Portaal"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {org && (
            <button
              onClick={handleOpenOrgDialog}
              className="text-xs text-foreground font-medium flex items-center gap-1 hover:underline"
            >
              <Building2 size={14} /> {org.name}
            </button>
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
        ) : isSupplier ? (
          /* ─── Supplier View ─── */
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Mijn Producten</h2>
                <p className="text-sm text-muted-foreground">
                  Beheer uw producten en diensten in de ledenvoordelenomgeving
                </p>
              </div>
              <Button onClick={handleNewBenefit} size="sm" className="gap-1">
                <Plus className="h-4 w-4" /> Nieuw product
              </Button>
            </div>

            {benefits.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <Package size={48} className="mx-auto text-muted-foreground" />
                <h3 className="font-semibold">Nog geen producten</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Voeg uw eerste product of dienst toe. Na plaatsing wordt het zichtbaar voor alle BCD-leden.
                </p>
                <Button onClick={handleNewBenefit} className="gap-1">
                  <Plus className="h-4 w-4" /> Product toevoegen
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {benefits.map((b) => {
                  const imageUrl = getBenefitImageUrl(b.image_path);
                  return (
                    <Card key={b.id} className={`overflow-hidden ${!b.active ? "opacity-50" : ""}`}>
                      <div className="relative aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                        {imageUrl ? (
                          <img src={imageUrl} alt={b.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="text-5xl font-bold text-muted-foreground/40">{b.title.charAt(0)}</div>
                        )}
                        <Badge variant="secondary" className="absolute top-2 right-2 shadow-sm">{b.category}</Badge>
                        {!b.active && (
                          <Badge variant="outline" className="absolute top-2 left-2 bg-background/80">Inactief</Badge>
                        )}
                      </div>
                      <CardContent className="p-4 space-y-2">
                        <h3 className="font-semibold text-base leading-tight line-clamp-2">{b.title}</h3>
                        {b.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{b.description}</p>
                        )}
                        {b.discount_info && (
                          <Badge variant="outline" className="text-xs border-primary/30 text-primary font-medium">
                            {b.discount_info}
                          </Badge>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => handleEditBenefit(b)}>
                            <Pencil className="h-3 w-3" /> Bewerken
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteBenefit(b.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            <BenefitFormDialog
              open={dialogOpen}
              onOpenChange={handleDialogClose}
              benefit={editBenefit}
              supplierOrgId={org.id}
            />
          </>
        ) : (
          /* ─── Regular External View ─── */
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
      {/* Org detail dialog */}
      <Dialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 size={18} /> {org?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Contactpersoon</Label>
              <Input
                value={orgEditForm.contact_name}
                onChange={(e) => setOrgEditForm(f => ({ ...f, contact_name: e.target.value }))}
                placeholder="Naam contactpersoon"
              />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={orgEditForm.contact_email}
                onChange={(e) => setOrgEditForm(f => ({ ...f, contact_email: e.target.value }))}
                placeholder="Contact e-mailadres"
              />
            </div>
            <div>
              <Label>Notities</Label>
              <Textarea
                value={orgEditForm.notes}
                onChange={(e) => setOrgEditForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="Eventuele opmerkingen"
              />
            </div>

            {orgUsers.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Users size={14} /> Geregistreerde gebruikers</Label>
                <div className="rounded-md border border-border divide-y divide-border">
                  {orgUsers.map(u => (
                    <div key={u.id} className="px-3 py-2 text-sm flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Mail size={12} className="text-muted-foreground" />
                        {u.email}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString("nl-NL")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleSaveOrg} disabled={savingOrg} className="w-full">
              {savingOrg ? "Opslaan..." : "Opslaan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExternDashboardPage;
