import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Building2, Users, Search, X } from "lucide-react";
import GemeentePublicaties from "@/components/GemeentePublicaties";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useMergedMembers } from "@/hooks/useMemberEdits";
import { getLocationGemeente } from "@/data/gemeenteMapping";
import { useRegisterStats } from "@/hooks/useRegisterStats";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";


const GemeenteDetailPage = () => {
  const { allRepresented } = useMembersData();
  const { members: mergedRepresented } = useMergedMembers(allRepresented);
  const { gemeente } = useParams<{ gemeente: string }>();
  const navigate = useNavigate();
  const decodedGemeente = gemeente ? decodeURIComponent(gemeente) : "";
  const [filterStadsdeel, setFilterStadsdeel] = useState<string>("alle");
  const [searchQuery, setSearchQuery] = useState("");
  const { perGemeente: perStad } = useRegisterStats();

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

    for (const m of mergedRepresented) {
      for (const l of m.locaties) {
        const plaats = l.plaats || m.plaats;
        if (getLocationGemeente(l, m.plaats) !== decodedGemeente) continue;
        // Skip empty placeholder rows (no address and no own place)
        if (!l.naam && !l.adres && !l.plaats) continue;

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
  }, [perStad, decodedGemeente, mergedRepresented]);

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
            <MapPin size={20} className="text-brand-red" />
            {decodedGemeente}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data.aangesloten} aangesloten coffeeshop{data.aangesloten !== 1 ? "s" : ""}
            {data.totaalNL > 0 && ` van ${data.totaalNL} totaal`}
          </p>
          <button
            onClick={() => navigate(`/coffeeshopregister/gemeente/${encodeURIComponent(decodedGemeente)}`)}
            className="text-xs text-primary hover:underline mt-1"
          >
            Bekijk registerdetails van deze gemeente →
          </button>
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
          <p className="text-xs text-muted-foreground mb-1">Vertegenwoordiging</p>
          <p className={`text-2xl font-bold font-display ${data.marktPct >= 30 ? "text-success" : ""}`}>
            {data.totaalNL > 0 ? `${data.marktPct}%` : "—"}
          </p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 text-center">
          <p className="text-xs text-muted-foreground mb-1">Stadsdelen</p>
          <p className="text-2xl font-bold font-display">{data.stadsdelen.length}</p>
        </div>
      </div>


      {/* Gemeentebeleid & Raadsinformatie */}
      <GemeentePublicaties gemeentenaam={decodedGemeente} />

      {/* Coffeeshops */}
      <div className="bg-card rounded-lg border border-border p-5">
        <h3 className="text-sm font-semibold font-display mb-3 flex items-center gap-2">
          <Users size={16} className="text-brand-red" />
          Aangesloten coffeeshops
        </h3>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Zoek coffeeshop..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-8 h-9 text-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>
          {data.sortedKeys.length > 1 && (
            <Select value={filterStadsdeel} onValueChange={setFilterStadsdeel}>
              <SelectTrigger className="h-9 w-full sm:w-44 text-sm">
                <SelectValue placeholder="Stadsdeel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="alle">Alle stadsdelen</SelectItem>
                {data.sortedKeys.map((sd) => (
                  <SelectItem key={sd} value={sd}>
                    {sd} ({data.perStadsdeel[sd].length})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* List */}
        {(() => {
          const q = searchQuery.toLowerCase();
          const filtered = data.locaties
            .filter((loc) => filterStadsdeel === "alle" || (loc.stadsdeel || "Overig") === filterStadsdeel)
            .filter((loc) => !q || loc.naam.toLowerCase().includes(q) || loc.adres.toLowerCase().includes(q) || loc.memberNaam.toLowerCase().includes(q))
            .sort((a, b) => a.naam.localeCompare(b.naam));

          if (filtered.length === 0) {
            return <p className="text-sm text-muted-foreground text-center py-4">Geen coffeeshops gevonden</p>;
          }

          return (
            <div className="space-y-0.5">
              {filtered.map((loc, i) => (
                <Link
                  key={`${loc.memberId}-${i}`}
                  to={`/leden/${loc.memberId}`}
                  className="flex items-start gap-3 px-3 py-2 rounded-md hover:bg-muted/30 transition-colors group"
                >
                  <MapPin size={14} className="text-brand-red shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium font-display group-hover:text-primary transition-colors">
                      {loc.naam}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {loc.adres && <span className="truncate">{loc.adres}</span>}
                      {loc.stadsdeel && (
                        <span className="shrink-0 px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium uppercase tracking-wider">
                          {loc.stadsdeel}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default GemeenteDetailPage;
