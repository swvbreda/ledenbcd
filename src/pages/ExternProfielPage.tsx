import { useEffect, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Building2, ArrowLeft, Save, Globe, Phone, Mail, MapPin,
  Users, FileText, Briefcase, Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import bcdLogo from "@/assets/bcd-logo.png";

interface OrgProfile {
  id: string;
  name: string;
  type: string;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  kvk: string | null;
  description: string | null;
  logo_path: string | null;
}

interface OrgUser {
  id: string;
  email: string;
  created_at: string;
}

const ExternProfielPage = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [org, setOrg] = useState<OrgProfile | null>(null);
  const [form, setForm] = useState({
    name: "",
    contact_name: "",
    contact_email: "",
    phone: "",
    address: "",
    postcode: "",
    city: "",
    website: "",
    kvk: "",
    description: "",
    notes: "",
  });
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
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
        .select("*")
        .eq("id", orgUserData.org_id)
        .single();

      if (orgData) {
        const o = orgData as unknown as OrgProfile;
        setOrg(o);
        setForm({
          name: o.name || "",
          contact_name: o.contact_name || "",
          contact_email: o.contact_email || "",
          phone: (o as any).phone || "",
          address: (o as any).address || "",
          postcode: (o as any).postcode || "",
          city: (o as any).city || "",
          website: (o as any).website || "",
          kvk: (o as any).kvk || "",
          description: (o as any).description || "",
          notes: o.notes || "",
        });

        // Load users
        const { data: links } = await supabase
          .from("external_org_users")
          .select("user_id, created_at")
          .eq("org_id", o.id);

        if (links) {
          setOrgUsers(
            links.map((u) => ({
              id: u.user_id,
              email:
                u.user_id === user.id
                  ? user.email || "Onbekend"
                  : "Geregistreerd gebruiker",
              created_at: u.created_at,
            }))
          );
        }
      }

      setLoading(false);
    };

    load();
  }, [user]);

  const handleChange = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSave = async () => {
    if (!org) return;
    setSaving(true);

    const { error } = await supabase
      .from("external_organizations")
      .update({
        name: form.name.trim() || org.name,
        contact_name: form.contact_name.trim() || null,
        contact_email: form.contact_email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        postcode: form.postcode.trim() || null,
        city: form.city.trim() || null,
        website: form.website.trim() || null,
        kvk: form.kvk.trim() || null,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
      } as any)
      .eq("id", org.id);

    if (error) {
      toast.error("Fout bij opslaan: " + error.message);
    } else {
      toast.success("Bedrijfsprofiel bijgewerkt");
      setOrg({ ...org, ...form } as any);
    }
    setSaving(false);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Laden...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/extern-login" replace />;
  if (!org) return <Navigate to="/extern" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card px-6 h-14">
        <div className="flex items-center gap-3">
          <img src={bcdLogo} alt="BCD" className="h-8 w-auto" />
          <h1 className="text-sm font-semibold font-display text-foreground">
            Bedrijfsprofiel
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/extern")}
            className="gap-1 text-xs"
          >
            <ArrowLeft size={14} /> Terug naar portaal
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Company name header */}
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1">
            <Input
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="text-xl font-bold border-none px-0 h-auto focus-visible:ring-0 bg-transparent"
              placeholder="Bedrijfsnaam"
            />
            <p className="text-sm text-muted-foreground capitalize">{org.type}</p>
          </div>
        </div>

        <Separator />

        {/* Bedrijfsgegevens */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase size={16} /> Bedrijfsgegevens
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">KvK-nummer</Label>
                <Input
                  value={form.kvk}
                  onChange={(e) => handleChange("kvk", e.target.value)}
                  placeholder="12345678"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Website</Label>
                <div className="relative">
                  <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={form.website}
                    onChange={(e) => handleChange("website", e.target.value)}
                    placeholder="https://www.voorbeeld.nl"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Beschrijving</Label>
              <Textarea
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value)}
                rows={3}
                placeholder="Korte beschrijving van uw bedrijf en diensten..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Adresgegevens */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin size={16} /> Adresgegevens
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Adres</Label>
              <Input
                value={form.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Straatnaam 123"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Postcode</Label>
                <Input
                  value={form.postcode}
                  onChange={(e) => handleChange("postcode", e.target.value)}
                  placeholder="1234 AB"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Plaats</Label>
                <Input
                  value={form.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  placeholder="Amsterdam"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contactgegevens */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone size={16} /> Contactgegevens
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Contactpersoon</Label>
                <Input
                  value={form.contact_name}
                  onChange={(e) => handleChange("contact_name", e.target.value)}
                  placeholder="Naam contactpersoon"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Telefoonnummer</Label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="06 12345678"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">E-mailadres</Label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  value={form.contact_email}
                  onChange={(e) => handleChange("contact_email", e.target.value)}
                  placeholder="info@bedrijf.nl"
                  className="pl-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notities */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText size={16} /> Notities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              rows={3}
              placeholder="Interne opmerkingen..."
            />
          </CardContent>
        </Card>

        {/* Geregistreerde gebruikers */}
        {orgUsers.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Users size={16} /> Geregistreerde gebruikers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border divide-y divide-border">
                {orgUsers.map((u) => (
                  <div
                    key={u.id}
                    className="px-4 py-3 text-sm flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Mail size={14} className="text-muted-foreground" />
                      {u.email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Sinds{" "}
                      {new Date(u.created_at).toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save button */}
        <div className="sticky bottom-6">
          <Button
            onClick={handleSave}
            disabled={saving}
            size="lg"
            className="w-full gap-2 shadow-lg"
          >
            <Save size={16} />
            {saving ? "Opslaan..." : "Profiel opslaan"}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ExternProfielPage;
