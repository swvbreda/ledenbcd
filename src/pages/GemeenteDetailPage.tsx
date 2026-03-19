import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Building2, Users, Notebook, ChevronDown, ChevronRight } from "lucide-react";
import { allRepresented, allMembers } from "@/hooks/useMembers";
import coffeeshopData from "@/data/coffeeshops-nl.json";

const perStad = coffeeshopData.perStad as Record<string, number>;

const GemeenteDetailPage = () => {
  const { gemeente } = useParams<{ gemeente: string }>();
  const navigate = useNavigate();
  const decodedGemeente = gemeente ? decodeURIComponent(gemeente) : "";
  const [expandedSd, setExpandedSd] = useState<Set<string>>(new Set());

  const data = useMemo(() => {
    if (!decodedGemeente) return null;

    const totaalNL = perStad[decodedGemeente] || 0;

    // Collect all represented locations in this city (dedupe on same physical address)
    const normalizeLocationValue = (value: string) =>
      value.trim().toLowerCase().replace(/\s+/g, " ");

    const getLocationKey = (plaats: string, naam: string, adres?: string) => {
      const normalizedPlaats = normalizeLocationValue(plaats);
      const normalizedAdres = normalizeLocationValue(adres || "");

      if (normalizedAdres) return `${normalizedPlaats}::adres::${normalizedAdres}`;

      const normalizedNaam = normalizeLocationValue(naam).replace(/^coffeeshop\s+/, "");
      return `${normalizedPlaats}::naam::${normalizedNaam}`;
    };

    const getNamePriority = (name: string) => {
      const normalized = normalizeLocationValue(name);
      return (normalized.startsWith("coffeeshop") ? 1000 : 0) + normalized.length;
    };

    const locatiesMap = new Map<string, { naam: string; adres: string; stadsdeel: string; memberNaam: string; memberId: number }>();

    for (const m of allRepresented) {
      for (const l of m.locaties) {
        const plaats = l.plaats || m.plaats;
        if (plaats !== decodedGemeente) continue;

        const sd = l.stadsdeel || m.stadsdeel || "";
        const locatieNaam = l.naam || m.naam;
        const key = getLocationKey(plaats, locatieNaam, l.adres);
        const existing = locatiesMap.get(key);

        if (!existing) {
          locatiesMap.set(key, {
            naam: locatieNaam,
            adres: l.adres || "",
            stadsdeel: sd,
            memberNaam: m.naam,
            memberId: m.id,
          });
          continue;
        }

        if (getNamePriority(locatieNaam) > getNamePriority(existing.naam)) {
          existing.naam = locatieNaam;
          existing.memberNaam = m.naam;
          existing.memberId = m.id;
        }

        if (!existing.adres && l.adres) existing.adres = l.adres;
        if (!existing.stadsdeel && sd) existing.stadsdeel = sd;
      }
    }

    const locaties = Array.from(locatiesMap.values());
    const stadsdeelCount: Record<string, number> = {};

    for (const loc of locaties) {
      if (loc.stadsdeel) {
        stadsdeelCount[loc.stadsdeel] = (stadsdeelCount[loc.stadsdeel] || 0) + 1;
      }
    }

    const aangesloten = locaties.length;
    const marktPct = totaalNL > 0 ? Math.round((aangesloten / totaalNL) * 100) : 0;

    const stadsdelen = Object.entries(stadsdeelCount)
      .map(([naam, aantal]) => ({ naam, aantal }))
      .sort((a, b) => b.aantal - a.aantal);

    // Group locaties by stadsdeel
    const perStadsdeel: Record<string, typeof locaties> = {};
    for (const loc of locaties) {
      const key = loc.stadsdeel || "Overig";
      if (!perStadsdeel[key]) perStadsdeel[key] = [];
      perStadsdeel[key].push(loc);
    }

    // Sort keys: alphabetically, "Overig" last
    const sortedKeys = Object.keys(perStadsdeel).sort((a, b) => {
      if (a === "Overig") return 1;
      if (b === "Overig") return -1;
      return a.localeCompare(b);
    });

    return { totaalNL, aangesloten, marktPct, stadsdelen, perStadsdeel, sortedKeys, locaties };
  }, [decodedGemeente]);

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Gemeente niet gevonden.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/locaties")}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display flex items-center gap-2">
            <MapPin size={20} className="text-primary" />
            {decodedGemeente}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data.aangesloten} aangesloten coffeeshop{data.aangesloten !== 1 ? "s" : ""}
            {data.totaalNL > 0 && ` van ${data.totaalNL} totaal`}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Totaal coffeeshops</p>
          <p className="text-2xl font-bold font-display">{data.totaalNL || "—"}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Aangesloten</p>
          <p className="text-2xl font-bold font-display">{data.aangesloten}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Marktaandeel</p>
          <p className={`text-2xl font-bold font-display ${data.marktPct >= 30 ? "text-success" : ""}`}>
            {data.totaalNL > 0 ? `${data.marktPct}%` : "—"}
          </p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Stadsdelen</p>
          <p className="text-2xl font-bold font-display">{data.stadsdelen.length}</p>
        </div>
      </div>

      {/* Stadsdelen verdeling */}
      {data.stadsdelen.length > 0 && (
        <div className="bg-card rounded-lg border border-border p-5">
          <h3 className="text-sm font-semibold font-display mb-3 flex items-center gap-2">
            <Building2 size={16} className="text-primary" />
            Verdeling per stadsdeel
          </h3>
          <div className="space-y-2">
            {data.stadsdelen.map((sd) => {
              const pct = Math.round((sd.aantal / data.aangesloten) * 100);
              return (
                <div key={sd.naam} className="flex items-center gap-3">
                  <span className="text-sm w-24 sm:w-40 truncate">{sd.naam}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground w-16 text-right">
                    {sd.aantal} ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gemeentebeleid */}
      <div className="bg-card rounded-lg border border-border p-5">
        <h3 className="text-sm font-semibold font-display mb-2 flex items-center gap-2">
          <Notebook size={16} className="text-primary" />
          Gemeentebeleid
        </h3>
        <p className="text-sm text-muted-foreground italic">
          Nog geen beleidsinformatie beschikbaar voor {decodedGemeente}.
        </p>
      </div>

      {/* Coffeeshops per stadsdeel */}
      <div className="bg-card rounded-lg border border-border p-5">
        <h3 className="text-sm font-semibold font-display mb-3 flex items-center gap-2">
          <Users size={16} className="text-primary" />
          Aangesloten coffeeshops
        </h3>
        <div className="space-y-1">
          {data.sortedKeys.map((sdNaam) => {
            const isOpen = expandedSd.has(sdNaam);
            const locs = data.perStadsdeel[sdNaam];
            const toggleSd = () => {
              setExpandedSd((prev) => {
                const next = new Set(prev);
                if (next.has(sdNaam)) next.delete(sdNaam);
                else next.add(sdNaam);
                return next;
              });
            };

            return (
              <div key={sdNaam}>
                <button
                  onClick={toggleSd}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted/30 transition-colors text-left"
                >
                  {isOpen ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {sdNaam}
                  </span>
                  <span className="text-xs text-muted-foreground">· {locs.length}</span>
                </button>
                {isOpen && (
                  <div className="ml-5 space-y-0.5">
                    {locs
                      .sort((a, b) => a.naam.localeCompare(b.naam))
                      .map((loc, i) => (
                        <Link
                          key={`${loc.memberId}-${i}`}
                          to={`/leden/${loc.memberId}`}
                          className="flex items-start gap-3 px-3 py-1.5 rounded-md hover:bg-muted/30 transition-colors group"
                        >
                          <MapPin size={14} className="text-primary shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium font-display group-hover:text-primary transition-colors">
                              {loc.naam}
                            </p>
                            {loc.adres && (
                              <p className="text-xs text-muted-foreground truncate">{loc.adres}</p>
                            )}
                          </div>
                        </Link>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GemeenteDetailPage;
