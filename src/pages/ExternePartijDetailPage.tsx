import { useEffect, useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth } from "@/lib/invokeFunction";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft, Building2, Globe, Phone, Mail, MapPin, FileText,
  Briefcase, Users, Package, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

  useEffect(() => {
    if (!isAdmin || !id) return;

    const load = async () => {
      const [orgRes, contactsRes, benefitsRes, accountsRes] = await Promise.all([
        supabase.from("external_organizations").select("*").eq("id", id).single(),
        supabase.from("external_org_contacts").select("id, name, role, phone, email").eq("org_id", id),
        supabase.from("member_benefits").select("id, title, category, active, price").eq("supplier_org_id", id),
        supabase.from("external_org_users").select("user_id, created_at").eq("org_id", id),
      ]);

      if (orgRes.data) setOrg(orgRes.data as OrgDetail);
      setContacts(contactsRes.data ?? []);
      setBenefits(benefitsRes.data ?? []);

      // Fetch emails for linked accounts
      if (accountsRes.data && accountsRes.data.length > 0) {
        const { data: usersData } = await invokeWithAuth("manage-users", {
          body: { action: "list_users" },
        });
        const userMap = new Map<string, string>();
        if (usersData?.users) {
          for (const u of usersData.users) {
            userMap.set(u.id, u.email);
          }
        }
        setAccounts(
          accountsRes.data.map((a) => ({
            user_id: a.user_id,
            email: userMap.get(a.user_id) || "Onbekend",
            created_at: a.created_at,
          }))
        );
      }
      setLoading(false);
    };

    load();
  }, [isAdmin, id]);

  if (authLoading || loading) return <LoadingSpinner />;
  if (!isAdmin) return <Navigate to="/" replace />;
  if (!org) return <div className="p-6 text-muted-foreground">Organisatie niet gevonden.</div>;

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
