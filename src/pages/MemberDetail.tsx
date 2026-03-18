import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Mail, Phone, Building2, FileText, User, Calendar, Hash } from "lucide-react";
import { allMembers } from "@/hooks/useMembers";

const MemberDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
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
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground font-mono">#{member.id}</span>
            <h2 className="text-xl sm:text-2xl font-bold font-display">{member.naam}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin size={14} /> {member.plaats}
            </span>
            {member.stadsdeel && (
              <span className="px-2 py-0.5 bg-muted rounded text-xs">{member.stadsdeel}</span>
            )}
            {member.jarenLid && (
              <span className="inline-flex items-center gap-1">
                <Calendar size={14} /> {member.jarenLid} jaar lid
              </span>
            )}
            {member.oprichtingJaar && (
              <span className="text-xs">Opgericht: {member.oprichtingJaar}</span>
            )}
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contactgegevens */}
        <div className="bg-card rounded-lg border border-border p-5 space-y-4">
          <h3 className="text-sm font-semibold font-display flex items-center gap-2">
            <User size={16} className="text-primary" /> Contactgegevens
          </h3>
          <div className="space-y-3">
            <div>
              <p className="font-medium">{member.contactpersoon || "—"}</p>
              {member.functie && <p className="text-xs text-muted-foreground">{member.functie}</p>}
            </div>
            {member.email && (
              <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Mail size={14} /> {member.email}
              </a>
            )}
            {member.telefoon && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone size={14} /> {member.telefoon}
              </p>
            )}
            {member.bedrijfsnaam && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 size={14} /> {member.bedrijfsnaam}
              </p>
            )}
          </div>

          {member.contactpersoon2 && (
            <div className="pt-3 border-t border-border space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                2e Contactpersoon
              </p>
              <p className="font-medium text-sm">{member.contactpersoon2}</p>
              {member.functie2 && <p className="text-xs text-muted-foreground">{member.functie2}</p>}
              {member.email2 && (
                <a href={`mailto:${member.email2}`} className="flex items-center gap-2 text-xs text-primary hover:underline">
                  <Mail size={12} /> {member.email2}
                </a>
              )}
              {member.telefoon2 && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone size={12} /> {member.telefoon2}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Factuurgegevens */}
        <div className="bg-card rounded-lg border border-border p-5 space-y-3">
          <h3 className="text-sm font-semibold font-display flex items-center gap-2">
            <FileText size={16} className="text-primary" /> Factuurgegevens
          </h3>
          {member.factuurBedrijfsnaam ? (
            <p className="font-medium text-sm">{member.factuurBedrijfsnaam}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Geen bedrijfsnaam</p>
          )}
          {member.factuurKvk && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Hash size={14} /> KVK: {member.factuurKvk}
            </p>
          )}
          {member.factuurAdres && (
            <div className="text-sm text-muted-foreground">
              <p>{member.factuurAdres}</p>
              <p>
                {member.factuurPostcode && <>{member.factuurPostcode} </>}
                {member.factuurPlaats}
              </p>
            </div>
          )}
          {member.factuurEmail && (
            <a href={`mailto:${member.factuurEmail}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
              <Mail size={14} /> {member.factuurEmail}
            </a>
          )}
          {member.factuurTelefoon && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone size={14} /> {member.factuurTelefoon}
            </p>
          )}
        </div>
      </div>

      {/* Locaties */}
      <div className="bg-card rounded-lg border border-border p-5">
        <h3 className="text-sm font-semibold font-display flex items-center gap-2 mb-4">
          <MapPin size={16} className="text-primary" /> Locaties ({member.aantalLocaties})
        </h3>
        <div className="space-y-3">
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
                {loc.adres && <span>{loc.adres}</span>}
                {loc.postcode && <span> · {loc.postcode}</span>}
                {loc.plaats && <span> · {loc.plaats}</span>}
              </div>
              {loc.contactpersoon && (
                <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground flex flex-wrap items-center gap-3">
                  <span className="font-medium text-foreground">{loc.contactpersoon}</span>
                  {loc.functie && <span>{loc.functie}</span>}
                  {loc.telefoon && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={11} /> {loc.telefoon}
                    </span>
                  )}
                  {loc.email && (
                    <a href={`mailto:${loc.email}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                      <Mail size={11} /> {loc.email}
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MemberDetail;
