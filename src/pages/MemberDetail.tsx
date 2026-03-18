import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Mail, Phone, Building2, FileText, Users, Calendar, Hash, Globe, Instagram, ExternalLink, Shield, Lock } from "lucide-react";
import { allMembers } from "@/hooks/useMembers";
import { useAuth } from "@/hooks/useAuth";

const MemberDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const member = allMembers.find((m) => String(m.id) === id);

  if (!member) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Lid niet gevonden</p>
        <button onClick={() => navigate("/leden")} className="mt-4 text-primary hover:underline text-sm">
          Terug naar ledenlijst
        </button>
      </div>
    );
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="mt-1 p-2 rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-semibold font-mono">Lidnr. {member.id}</span>
            <h2 className="text-xl sm:text-2xl font-bold font-display">{member.naam}</h2>
            {member.bestuursfunctie && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-accent/15 text-accent-foreground rounded-md text-xs font-semibold">
                <Shield size={13} />
                {member.bestuursfunctie}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} /> {member.plaats}
            </span>
            {member.stadsdeel && (
              <span className="px-2 py-0.5 bg-muted rounded text-xs">{member.stadsdeel}</span>
            )}
            {member.jarenLid !== null && (
              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                member.jarenLid >= 30
                  ? "bg-success/10 text-success"
                  : member.jarenLid >= 10
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}>
                {member.jarenLid} jaar lid
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Oprichting & KVK */}
      {(member.oprichtingsDatum || member.oprichtingJaar || member.lidSinds) && (
        <div className="bg-card rounded-lg border border-border p-5 flex flex-wrap gap-6">
          {(member.oprichtingsDatum || member.oprichtingJaar) && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={16} className="text-primary" />
              <span className="text-muted-foreground">Opgericht:</span>
              <span className="font-medium">
                {member.oprichtingsDatum
                  ? formatDate(member.oprichtingsDatum)
                  : member.oprichtingJaar}
              </span>
            </div>
          )}
          {member.lidSinds && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={16} className="text-success" />
              <span className="text-muted-foreground">Lid sinds:</span>
              <span className="font-medium">{member.lidSinds}</span>
              <span className="text-xs text-muted-foreground">
                ({new Date().getFullYear() - member.lidSinds} jaar)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Website & Social Media */}
      {(member.website || member.instagram || member.facebook) && (
        <div className="bg-card rounded-lg border border-border p-5">
          <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-3">
            <Globe size={16} className="text-primary" /> Online
          </h3>
          <div className="flex flex-wrap gap-3">
            {member.website && (
              <a
                href={member.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Globe size={14} /> {member.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                <ExternalLink size={12} />
              </a>
            )}
            {member.instagram && (
              <a
                href={`https://instagram.com/${member.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <Instagram size={14} /> @{member.instagram}
                <ExternalLink size={12} />
              </a>
            )}
            {member.facebook && (
              <a
                href={`https://facebook.com/${member.facebook}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Facebook
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        </div>
      )}

      {isAdmin ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contactpersonen */}
          <div className="bg-card rounded-lg border border-border p-5">
            <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
              <Users size={16} className="text-primary" /> Contactpersonen ({member.contacten.length})
            </h3>
            <div className="space-y-4">
              {member.contacten.length > 0 ? (
                member.contacten.map((c, i) => (
                  <div key={i} className={i > 0 ? "pt-3 border-t border-border" : ""}>
                    <p className="font-medium">{c.naam}</p>
                    {c.functie && <p className="text-xs text-muted-foreground">{c.functie}</p>}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-1">
                        <Mail size={13} /> {c.email}
                      </a>
                    )}
                    {c.telefoon && (
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                        <Phone size={13} /> {c.telefoon}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Geen contactpersonen bekend</p>
              )}
            </div>
          </div>

          {/* Factuurgegevens */}
          <div className="bg-card rounded-lg border border-border p-5">
            <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
              <FileText size={16} className="text-primary" /> Factuurgegevens
            </h3>
             <div className="space-y-2">
              {(member.factuurBedrijfsnaam || member.bedrijfsnaam) ? (
                <p className="font-medium">{member.factuurBedrijfsnaam || member.bedrijfsnaam}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Geen bedrijfsnaam</p>
              )}
              {(member.factuurKvk || member.kvk) && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Hash size={13} /> KVK: <span className="font-mono">{member.factuurKvk || member.kvk}</span>
                </p>
              )}
              {member.factuurAdres && (
                <div className="text-sm text-muted-foreground mt-2">
                  <p>{member.factuurAdres}</p>
                  <p>
                    {member.factuurPostcode && <>{member.factuurPostcode} </>}
                    {member.factuurPlaats}
                  </p>
                </div>
              )}
              {member.factuurEmail && (
                <a href={`mailto:${member.factuurEmail}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-1">
                  <Mail size={13} /> {member.factuurEmail}
                </a>
              )}
              {member.factuurTelefoon && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  <Phone size={13} /> {member.factuurTelefoon}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border p-5 flex items-center gap-3 text-muted-foreground">
          <Lock size={16} />
          <p className="text-sm">Contactgegevens en factuurgegevens zijn alleen zichtbaar voor bestuursleden.</p>
        </div>
      )}

      {/* Locaties */}
      <div className="bg-card rounded-lg border border-border p-5">
        <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
          <MapPin size={16} className="text-primary" /> Locaties ({member.aantalLocaties})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {member.locaties.map((loc, i) => (
            <div key={i} className="border border-border rounded-md p-4 hover:bg-muted/20 transition-colors">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium font-display">{loc.naam}</span>
                {loc.stadsdeel && (
                  <span className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground">
                    {loc.stadsdeel}
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-sm text-muted-foreground">
                {loc.adres && <p>{loc.adres}</p>}
                <p>
                  {loc.postcode && <>{loc.postcode} </>}
                  {loc.plaats}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MemberDetail;
