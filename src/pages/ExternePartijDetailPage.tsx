import { useEffect, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth } from "@/lib/invokeFunction";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, Building2, Globe, Phone, Mail, MapPin, FileText,
  Briefcase, Users, Package, ExternalLink, Plus, Pencil, Trash2, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Link } from "react-router-dom";

interface OrgDetail {
  id: string;
  name: string;
  type: string;
  approved: boolean;
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  kvk: string | null;
  description: string | null;
  logo_path: string | null;
  notes: string | null;
  created_at: string;
}

interface OrgContact {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
}

interface LinkedBenefit {
  id: string;
  title: string;
  category: string;
  active: boolean;
  price: number | null;
}

interface LinkedAccount {
  user_id: string;
  email: string;
  created_at: string;
}

const ORG_TYPE_LABELS: Record<string, string> = {
  bank: "Bank",
  overheid: "Overheid",
  leverancier: "Leverancier / Aanbieder",
  anders: "Anders",
};

export default function ExternePartijDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, loading: authLoading } = useAuth();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [contacts, setContacts] = useState<OrgContact[]>([]);
  const [benefits, setBenefits] = useState<LinkedBenefit[]>([]);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const [contactForm, setContactForm] = useState<{ id?: string; name: string; role: string; phone: string; email: string } | null>(null);
  const [savingContact, setSavingContact] = useState(false);
  const [invitingEmail, setInvitingEmail] = useState<string | null>(null);

  const loadContacts = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("external_org_contacts")
      .select("id, name, role, phone, email")
      .eq("org_id", id)
      .order("created_at");
    setContacts(data ?? []);
  };

  const loadAccounts = async () => {
    if (!id) return;
    const { data: links } = await supabase
      .from("external_org_users")
      .select("user_id, created_at")
      .eq("org_id", id);
    if (!links || links.length === 0) {
      setAccounts([]);
      return;
    }
    const { data: usersData } = await invokeWithAuth("manage-users", { body: { action: "list" } });
    const userMap = new Map<string, string>();
    if (usersData?.users) {
      for (const u of usersData.users) userMap.set(u.id, u.email);
    }
    setAccounts(
      links.map((a) => ({
        user_id: a.user_id,
        email: userMap.get(a.user_id) || "Onbekend",
        created_at: a.created_at,
      }))
    );
  };

  useEffect(() => {
    if (!isAdmin || !id) return;

    const load = async () => {
      const [orgRes, benefitsRes] = await Promise.all([
        supabase.from("external_organizations").select("*").eq("id", id).single(),
        supabase.from("member_benefits").select("id, title, category, active, price").eq("supplier_org_id", id),
      ]);

      if (orgRes.data) setOrg(orgRes.data as OrgDetail);
      setBenefits(benefitsRes.data ?? []);
      await Promise.all([loadContacts(), loadAccounts()]);
      setLoading(false);
    };

    load();
  }, [isAdmin, id]);

  const saveContact = async () => {
    if (!contactForm || !id || !contactForm.name.trim()) return;
    setSavingContact(true);
    const values = {
      org_id: id,
      name: contactForm.name.trim(),
      role: contactForm.role.trim() || null,
      phone: contactForm.phone.trim() || null,
      email: contactForm.email.trim().toLowerCase() || null,
    };
    const { error } = contactForm.id
      ? await supabase.from("external_org_contacts").update(values).eq("id", contactForm.id)
      : await supabase.from("external_org_contacts").insert(values);
    if (error) {
      toast.error("Opslaan mislukt: " + error.message);
    } else {
      toast.success("Contactpersoon opgeslagen");
      setContactForm(null);
      loadContacts();
    }
    setSavingContact(false);
  };

  const deleteContact = async (contactId: string) => {
    if (!confirm("Deze contactpersoon verwijderen?")) return;
    const { error } = await supabase.from("external_org_contacts").delete().eq("id", contactId);
    if (error) toast.error("Verwijderen mislukt: " + error.message);
    else {
      toast.success("Contactpersoon verwijderd");
      loadContacts();
    }
  };

  const inviteContact = async (contact: OrgContact) => {
    if (!contact.email || !id) return;
    if (!confirm(`Uitnodiging met inloggegevens sturen naar ${contact.email}?`)) return;
    setInvitingEmail(contact.email);
    try {
      const { data, error } = await invokeWithAuth("invite-extern", {
        body: { org_id: id, contacts: [{ name: contact.name, email: contact.email, role: contact.role ?? "", phone: contact.phone ?? "" }] },
      });
      if (error) throw new Error(error.message);
      if (data?.error && !data?.sent) throw new Error(data.error);
      toast.success("Uitnodiging verstuurd naar " + contact.email);
      loadAccounts();
    } catch (e: any) {
      toast.error("Uitnodigen mislukt: " + e.message);
    }
    setInvitingEmail(null);
  };

  if (authLoading || loading) return <LoadingSpinner />;
  if (!isAdmin) return <Navigate to="/" replace />;
  if (!org) return <div className="p-6 text-muted-foreground">Organisatie niet gevonden.</div>;

  const accountEmails = new Set(accounts.map((a) => a.email.toLowerCase()));


  const logoUrl = org.logo_path
    ? supabase.storage.from("org-logos").getPublicUrl(org.logo_path).data.publicUrl
    : null;

  return (
    <div className="p-4 sm:p-6 space-y-6 w-full">
      <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/externe-partijen")}>
        <ArrowLeft className="h-4 w-4" /> Terug
      </Button>

      {/* Header */}
      <div className="flex items-start gap-4">
        {logoUrl ? (
          <img src={logoUrl} alt={org.name} className="w-16 h-16 rounded-lg object-contain border bg-white" />
        ) : (
          <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
            <Building2 className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold font-display">{org.name}</h1>
          <div className="flex items-center gap-2">
            <Badge variant={org.approved ? "default" : "outline"}>
              {org.approved ? "Goedgekeurd" : "Wacht op goedkeuring"}
            </Badge>
            <span className="text-xs text-muted-foreground">{ORG_TYPE_LABELS[org.type] || org.type}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bedrijfsgegevens */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Briefcase className="h-4 w-4" /> Bedrijfsgegevens
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {org.kvk && (
              <div className="flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span>KvK: {org.kvk}</span>
              </div>
            )}
            {(org.address || org.postcode || org.city) && (
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
                <span>{[org.address, [org.postcode, org.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</span>
              </div>
            )}
            {org.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{org.phone}</span>
              </div>
            )}
            {org.website && (
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {org.website}
                </a>
              </div>
            )}
            {org.contact_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{org.contact_email}</span>
              </div>
            )}
            {org.contact_name && (
              <div className="text-xs text-muted-foreground">Contactpersoon: {org.contact_name}</div>
            )}
            {org.description && (
              <>
                <Separator />
                <p className="text-muted-foreground">{org.description}</p>
              </>
            )}
            {org.notes && (
              <>
                <Separator />
                <p className="text-muted-foreground italic">Notitie: {org.notes}</p>
              </>
            )}
            {!org.kvk && !org.address && !org.phone && !org.website && !org.contact_email && !org.description && (
              <p className="text-muted-foreground">Geen bedrijfsgegevens ingevuld.</p>
            )}
          </CardContent>
        </Card>

        {/* Contactpersonen */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" /> Extra contactpersonen ({contacts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Geen extra contactpersonen.</p>
            ) : (
              <div className="space-y-3">
                {contacts.map((c) => (
                  <div key={c.id} className="text-sm space-y-0.5">
                    <div className="font-medium">{c.name}</div>
                    {c.role && <div className="text-xs text-muted-foreground">{c.role}</div>}
                    {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                    {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gekoppelde producten */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" /> Gekoppelde producten ({benefits.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {benefits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen producten gekoppeld aan deze organisatie.</p>
          ) : (
            <div className="space-y-2">
              {benefits.map((b) => (
                <Link
                  key={b.id}
                  to={`/ledenvoordelen/${b.id}`}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-sm">{b.title}</span>
                    <Badge variant="outline" className="text-xs">{b.category}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.price != null && (
                      <span className="text-sm font-medium">€{b.price.toFixed(2)}</span>
                    )}
                    <Badge variant={b.active ? "default" : "secondary"} className="text-xs">
                      {b.active ? "Actief" : "Inactief"}
                    </Badge>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gekoppelde accounts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="h-4 w-4" /> Gekoppelde accounts ({accounts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen accounts gekoppeld aan deze organisatie.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <div key={a.user_id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                  <span className="text-sm">{a.email}</span>
                  <span className="text-xs text-muted-foreground">
                    Sinds {new Date(a.created_at).toLocaleDateString("nl-NL")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Aangemeld op {new Date(org.created_at).toLocaleDateString("nl-NL")}
      </p>
    </div>
  );
}
