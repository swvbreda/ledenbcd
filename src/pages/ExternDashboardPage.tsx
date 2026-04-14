import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Building2, LogOut, ShieldCheck, ShieldX, Users, Package, Plus, Pencil, Trash2, Mail, Store, MapPin, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import bcdLogo from "@/assets/bcd-logo.png";
import BenefitFormDialog from "@/components/BenefitFormDialog";
import type { Benefit } from "@/hooks/useBenefits";
import { getBenefitImageUrl } from "@/hooks/useBenefits";
import type { Member } from "@/data/types";
import SupplierCoffeeshopTable from "@/components/SupplierCoffeeshopTable";
import SupplierGemeentenOverzicht from "@/components/SupplierGemeentenOverzicht";
import DocumentenZoeker from "@/components/DocumentenZoeker";

interface OrgInfo {
  id: string;
  name: string;
  type: string;
  approved: boolean;
  contact_email: string | null;
  contact_name: string | null;
  notes: string | null;
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
  const navigate = useNavigate();
  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [members, setMembers] = useState<MemberBasic[]>([]);
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExtern, setIsExtern] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBenefit, setEditBenefit] = useState<Benefit | null>(null);
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
            await Promise.all([
              loadSupplierBenefits(orgData.id),
              loadCoffeeshopMembers(),
            ]);
          } else {
            await loadMembers(orgData.id);
          }
        }
      }
      setLoading(false);
    };

    load();
  }, [user]);

  const loadCoffeeshopMembers = async (orgId: string) => {
    const { data: rpcData, error } = await supabase.rpc("get_members_for_extern", { _org_id: orgId });
    if (error) {
      console.error("Error loading members:", error);
      return;
    }
    const rows = (rpcData as any[]) ?? [];
    const parsed: Member[] = rows.map((r: any) => ({
      id: r.id,
      naam: r.naam || "-",
      bedrijfsnaam: r.coffeeshop || r.naam || "-",
      plaats: r.plaats || "-",
      stadsdeel: r.stadsdeel || "",
      jarenLid: null,
      oprichtingJaar: null,
      contactpersoon: "",
      functie: "",
      telefoon: "",
      email: "",
      aantalLocaties: Array.isArray(r.locaties) ? r.locaties.length : 0,
      locaties: Array.isArray(r.locaties) ? r.locaties : [],
      contacten: [],
    } as Member));
    setAllMembers(parsed);
  };

  const loadMembers = async (orgId: string) => {
    const { data: rpcData, error } = await supabase.rpc("get_members_for_extern", { _org_id: orgId });
    if (error) {
      console.error("Error loading members:", error);
      return;
    }
    const rows = (rpcData as any[]) ?? [];
    const mapped: MemberBasic[] = rows.map((r: any) => ({
      id: r.id,
      naam: r.naam || "-",
      coffeeshop: r.coffeeshop || r.naam || "-",
      plaats: r.plaats || "-",
      lid_sinds: r.lid_sinds ? Number(r.lid_sinds) : null,
      has_consent: r.has_consent || false,
      ...(r.has_consent ? {
        email: r.email,
        telefoon: r.telefoon,
        kvk: r.kvk,
      } : {}),
    }));
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
               onClick={() => navigate("/extern/profiel")}
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
            <Tabs value={supplierTab} onValueChange={(v) => setSupplierTab(v as any)}>
              <TabsList>
                <TabsTrigger value="producten" className="gap-1.5">
                  <Package size={14} /> Producten
                </TabsTrigger>
                <TabsTrigger value="coffeeshops" className="gap-1.5">
                  <Store size={14} /> Coffeeshops
                </TabsTrigger>
                <TabsTrigger value="gemeenten" className="gap-1.5">
                  <MapPin size={14} /> Gemeenten
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {supplierTab === "producten" && (
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
                          <div
                            className="relative aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden cursor-pointer"
                            onClick={() => navigate(`/extern/product/${b.id}`)}
                          >
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
                            <h3
                              className="font-semibold text-base leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                              onClick={() => navigate(`/extern/product/${b.id}`)}
                            >
                              {b.title}
                            </h3>
                            {b.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">{b.description}</p>
                            )}
                            {b.discount_info && (
                              <Badge variant="outline" className="text-xs border-primary/30 text-primary font-medium">
                                {b.discount_info}
                              </Badge>
                            )}
                            <div className="flex gap-2 pt-2">
                              <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => navigate(`/extern/product/${b.id}`)}>
                                <Eye className="h-3 w-3" /> Bekijken
                              </Button>
                              <Button variant="outline" size="sm" className="gap-1" onClick={() => handleEditBenefit(b)}>
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
              </>
            )}

            {supplierTab === "coffeeshops" && (
              <SupplierCoffeeshopTable members={allMembers} />
            )}

            {supplierTab === "gemeenten" && (
              <div className="space-y-4">
                <SupplierGemeentenOverzicht members={allMembers} />
                <DocumentenZoeker />
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
    </div>
  );
};

export default ExternDashboardPage;
