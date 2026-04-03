import { useEffect, useState, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Building2, ArrowLeft, Save, Globe, Phone, Mail, MapPin,
  Users, FileText, Briefcase, Upload, Trash2, Plus, X,
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

interface OrgContact {
  id: string;
  org_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
}

const ExternProfielPage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [org, setOrg] = useState<OrgProfile | null>(null);
  const [form, setForm] = useState({
    name: "", contact_name: "", contact_email: "", phone: "",
    address: "", postcode: "", city: "", website: "", kvk: "",
    description: "", notes: "",
  });
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [contacts, setContacts] = useState<OrgContact[]>([]);
  const [newContact, setNewContact] = useState({ name: "", role: "", phone: "", email: "" });
  const [showAddContact, setShowAddContact] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data: orgUserData } = await supabase
        .from("external_org_users")
        .select("org_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!orgUserData) { setLoading(false); return; }

      const { data: orgData } = await supabase
        .from("external_organizations")
        .select("*")
        .eq("id", orgUserData.org_id)
        .single();

      if (orgData) {
        const o = orgData as unknown as OrgProfile;
        setOrg(o);
        setForm({
          name: o.name || "", contact_name: o.contact_name || "",
          contact_email: o.contact_email || "", phone: o.phone || "",
          address: o.address || "", postcode: o.postcode || "",
          city: o.city || "", website: o.website || "",
          kvk: o.kvk || "", description: o.description || "",
          notes: o.notes || "",
        });

        // Logo URL
        if (o.logo_path) {
          const { data: urlData } = supabase.storage.from("org-logos").getPublicUrl(o.logo_path);
          setLogoUrl(urlData.publicUrl);
        }

        // Load users & contacts in parallel
        const [linksRes, contactsRes] = await Promise.all([
          supabase.from("external_org_users").select("user_id, created_at").eq("org_id", o.id),
          supabase.from("external_org_contacts").select("*").eq("org_id", o.id),
        ]);

        if (linksRes.data) {
          setOrgUsers(linksRes.data.map((u) => ({
            id: u.user_id,
            email: u.user_id === user.id ? user.email || "Onbekend" : "Geregistreerd gebruiker",
            created_at: u.created_at,
          })));
        }
        if (contactsRes.data) {
          setContacts(contactsRes.data as unknown as OrgContact[]);
        }
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const handleChange = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

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

    if (error) toast.error("Fout bij opslaan: " + error.message);
    else { toast.success("Bedrijfsprofiel bijgewerkt"); setOrg({ ...org, ...form } as any); }
    setSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !org) return;
    setUploadingLogo(true);

    const ext = file.name.split(".").pop();
    const path = `${org.id}/logo.${ext}`;

    // Remove old logo if exists
    if (org.logo_path) {
      await supabase.storage.from("org-logos").remove([org.logo_path]);
    }

    const { error: uploadError } = await supabase.storage.from("org-logos").upload(path, file, { upsert: true });
    if (uploadError) { toast.error("Upload mislukt: " + uploadError.message); setUploadingLogo(false); return; }

    await supabase.from("external_organizations").update({ logo_path: path } as any).eq("id", org.id);
    const { data: urlData } = supabase.storage.from("org-logos").getPublicUrl(path);
    setLogoUrl(urlData.publicUrl + "?t=" + Date.now());
    setOrg({ ...org, logo_path: path });
    toast.success("Logo geüpload");
    setUploadingLogo(false);
  };

  const handleRemoveLogo = async () => {
    if (!org?.logo_path) return;
    await supabase.storage.from("org-logos").remove([org.logo_path]);
    await supabase.from("external_organizations").update({ logo_path: null } as any).eq("id", org.id);
    setLogoUrl(null);
    setOrg({ ...org, logo_path: null });
    toast.success("Logo verwijderd");
  };

  const handleAddContact = async () => {
    if (!org || !newContact.name.trim()) return;
    const { data, error } = await supabase
      .from("external_org_contacts")
      .insert({ org_id: org.id, name: newContact.name.trim(), role: newContact.role.trim() || null, phone: newContact.phone.trim() || null, email: newContact.email.trim() || null } as any)
      .select()
      .single();
    if (error) { toast.error("Fout: " + error.message); return; }
    setContacts([...contacts, data as unknown as OrgContact]);
    setNewContact({ name: "", role: "", phone: "", email: "" });
    setShowAddContact(false);
    toast.success("Contactpersoon toegevoegd");
  };

  const handleDeleteContact = async (id: string) => {
    const { error } = await supabase.from("external_org_contacts").delete().eq("id", id);
    if (error) { toast.error("Fout: " + error.message); return; }
    setContacts(contacts.filter((c) => c.id !== id));
    toast.success("Contactpersoon verwijderd");
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground text-sm">Laden...</p></div>;
  }
  if (!user) return <Navigate to="/extern-login" replace />;
  if (!org) return <Navigate to="/extern" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-card px-6 h-14">
        <div className="flex items-center gap-3">
          <img src={bcdLogo} alt="BCD" className="h-8 w-auto" />
          <h1 className="text-sm font-semibold font-display text-foreground">Bedrijfsprofiel</h1>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/extern")} className="gap-1 text-xs">
          <ArrowLeft size={14} /> Terug naar portaal
        </Button>
      </header>

      <main className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Logo + Company name */}
        <div className="flex items-start gap-4">
          <div className="relative group">
            {logoUrl ? (
              <div className="relative h-20 w-20 rounded-xl border border-border overflow-hidden bg-muted">
                <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
                <button
                  onClick={handleRemoveLogo}
                  className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={18} className="text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                className="h-20 w-20 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Upload size={18} />
                <span className="text-[10px]">Logo</span>
              </button>
            )}
            {logoUrl && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md"
              >
                <Upload size={12} />
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
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
            <CardTitle className="text-base flex items-center gap-2"><Briefcase size={16} /> Bedrijfsgegevens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">KvK-nummer</Label>
                <Input value={form.kvk} onChange={(e) => handleChange("kvk", e.target.value)} placeholder="12345678" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Website</Label>
                <div className="relative">
                  <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={form.website} onChange={(e) => handleChange("website", e.target.value)} placeholder="https://www.voorbeeld.nl" className="pl-9" />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Beschrijving</Label>
              <Textarea value={form.description} onChange={(e) => handleChange("description", e.target.value)} rows={3} placeholder="Korte beschrijving van uw bedrijf en diensten..." />
            </div>
          </CardContent>
        </Card>

        {/* Adresgegevens */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2"><MapPin size={16} /> Adresgegevens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Adres</Label>
              <Input value={form.address} onChange={(e) => handleChange("address", e.target.value)} placeholder="Straatnaam 123" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Postcode</Label>
                <Input value={form.postcode} onChange={(e) => handleChange("postcode", e.target.value)} placeholder="1234 AB" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Plaats</Label>
                <Input value={form.city} onChange={(e) => handleChange("city", e.target.value)} placeholder="Amsterdam" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contactgegevens (hoofd) */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2"><Phone size={16} /> Hoofdcontact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Contactpersoon</Label>
                <Input value={form.contact_name} onChange={(e) => handleChange("contact_name", e.target.value)} placeholder="Naam contactpersoon" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Telefoonnummer</Label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} placeholder="06 12345678" className="pl-9" />
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">E-mailadres</Label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input type="email" value={form.contact_email} onChange={(e) => handleChange("contact_email", e.target.value)} placeholder="info@bedrijf.nl" className="pl-9" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Extra contactpersonen */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Users size={16} /> Extra contactpersonen</CardTitle>
              <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setShowAddContact(true)}>
                <Plus size={14} /> Toevoegen
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showAddContact && (
              <div className="mb-4 rounded-lg border border-border p-4 space-y-3 bg-muted/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Naam *</Label>
                    <Input value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} placeholder="Volledige naam" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Functie</Label>
                    <Input value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} placeholder="Bijv. Accountmanager" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Telefoon</Label>
                    <Input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} placeholder="06 12345678" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">E-mail</Label>
                    <Input value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} placeholder="naam@bedrijf.nl" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddContact} disabled={!newContact.name.trim()}>Opslaan</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowAddContact(false); setNewContact({ name: "", role: "", phone: "", email: "" }); }}>
                    <X size={14} /> Annuleren
                  </Button>
                </div>
              </div>
            )}

            {contacts.length === 0 && !showAddContact ? (
              <p className="text-sm text-muted-foreground">Nog geen extra contactpersonen toegevoegd.</p>
            ) : (
              <div className="rounded-md border border-border divide-y divide-border">
                {contacts.map((c) => (
                  <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[c.role, c.email, c.phone].filter(Boolean).join(" · ") || "Geen gegevens"}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteContact(c.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notities */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2"><FileText size={16} /> Notities</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea value={form.notes} onChange={(e) => handleChange("notes", e.target.value)} rows={3} placeholder="Interne opmerkingen..." />
          </CardContent>
        </Card>

        {/* Geregistreerde gebruikers */}
        {orgUsers.length > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2"><Users size={16} /> Geregistreerde gebruikers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-border divide-y divide-border">
                {orgUsers.map((u) => (
                  <div key={u.id} className="px-4 py-3 text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2"><Mail size={14} className="text-muted-foreground" />{u.email}</span>
                    <span className="text-xs text-muted-foreground">
                      Sinds {new Date(u.created_at).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save */}
        <div className="sticky bottom-6">
          <Button onClick={handleSave} disabled={saving} size="lg" className="w-full gap-2 shadow-lg">
            <Save size={16} /> {saving ? "Opslaan..." : "Profiel opslaan"}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default ExternProfielPage;
