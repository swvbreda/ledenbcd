import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Building2, MapPin, MinusCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useMergedMembers } from "@/hooks/useMemberEdits";
import { useCoffeeshopRegister, useRegisterLinks } from "@/hooks/useCoffeeshopRegister";
import { exclusionReason, isActiveShop } from "@/lib/registerActive";
import { isRealLocation } from "@/lib/locationCount";
import { findMemberLocation } from "@/lib/registerLocationMatch";
import { getGemeente } from "@/data/gemeenteMapping";
import { Badge } from "@/components/ui/badge";

const shopAdres = (s: {
  straat?: string | null;
  huisnummer?: string | null;
  huisnummer_toevoeging?: string | null;
  postcode?: string | null;
  plaats?: string | null;
}) =>
  [
    [s.straat, [s.huisnummer, s.huisnummer_toevoeging].filter(Boolean).join("")]
      .filter(Boolean)
      .join(" ")
      .trim(),
    [s.postcode, s.plaats].filter(Boolean).join(" ").trim(),
  ]
    .filter(Boolean)
    .join(", ");

type LocRow = {
  memberId: number;
  memberNaam: string;
  naam: string;
  adres: string;
  gekoppeld: boolean;
};

const RegisterGemeenteDetailPage = () => {
  const navigate = useNavigate();
  const { gemeente } = useParams<{ gemeente: string }>();
  const decoded = gemeente ? decodeURIComponent(gemeente) : "";
  const { isAdmin, isBoard } = useAuth();
  const allowed = isAdmin || isBoard;

  const { data: shops = [], isLoading } = useCoffeeshopRegister(allowed);
  const { data: links = [] } = useRegisterLinks(allowed);
  const { allRepresented } = useMembersData();
  const { members } = useMergedMembers(allRepresented);

  const linkByShop = useMemo(() => {
    const map = new Map<string, { member_id: number; status: string; location_key: string | null }>();
    links.forEach((l) => {
      if (l.status === "afgewezen") return;
      const current = map.get(l.register_id);
      if (!current || (current.status !== "bevestigd" && l.status === "bevestigd")) {
        map.set(l.register_id, { member_id: l.member_id, status: l.status, location_key: l.location_key });
      }
    });
    return map;
  }, [links]);

  const memberNaam = useMemo(() => {
    const map = new Map<number, string>();
    members.forEach((m) => map.set(m.id, m.naam || `Lid #${m.id}`));
    return map;
  }, [members]);

  const data = useMemo(() => {
    const inGemeente = shops.filter((s) => getGemeente(s.gemeente || s.plaats || "") === decoded);
    const actief = inGemeente.filter(isActiveShop);
    const uitgesloten = inGemeente.filter((s) => !isActiveShop(s));

    const bevestigdeShops = actief.filter((s) => linkByShop.get(s.id)?.status === "bevestigd");

    // Ledenlocaties in deze gemeente, met of zonder registerkoppeling
    const zonderKoppeling: LocRow[] = [];
    const gekoppeldZonderVestiging: LocRow[] = [];

    for (const m of members) {
      const locs = (m.locaties ?? []).filter(
        (l) => isRealLocation(l) && getGemeente(l.plaats || m.plaats || "") === decoded,
      );
      if (!locs.length) continue;

      const memberLinks = bevestigdeShops.filter((s) => linkByShop.get(s.id)?.member_id === m.id);
      const matched = new Set<number>();
      let zonderVestiging = 0;

      for (const shop of memberLinks) {
        const key = linkByShop.get(shop.id)?.location_key ?? null;
        const loc = key ? findMemberLocation(locs, key) : null;
        const idx = loc ? locs.indexOf(loc) : -1;
        if (idx >= 0 && !matched.has(idx)) matched.add(idx);
        else zonderVestiging++;
      }

      locs.forEach((l, idx) => {
        if (matched.has(idx)) return;
        const row: LocRow = {
          memberId: m.id,
          memberNaam: m.naam,
          naam: l.naam || m.naam,
          adres: [l.adres, l.postcode, l.plaats || m.plaats].filter(Boolean).join(", "),
          gekoppeld: zonderVestiging > 0,
        };
        if (zonderVestiging > 0) {
          zonderVestiging--;
          gekoppeldZonderVestiging.push(row);
        } else {
          zonderKoppeling.push(row);
        }
      });
    }

    const vertegenwoordigd = bevestigdeShops.length + zonderKoppeling.length;
    const pct = actief.length > 0 ? Math.round((vertegenwoordigd / actief.length) * 100) : 0;

    return {
      actief: actief.sort((a, b) => (a.naam || "").localeCompare(b.naam || "")),
      uitgesloten: uitgesloten.sort((a, b) => (a.naam || "").localeCompare(b.naam || "")),
      bevestigd: bevestigdeShops.length,
      zonderKoppeling,
      gekoppeldZonderVestiging,
      vertegenwoordigd,
      pct,
    };
  }, [shops, members, linkByShop, decoded]);

  if (!allowed) {
    return (
      <div className="p-6">
        <h1 className="font-display text-2xl uppercase">Geen toegang</h1>
        <p className="text-muted-foreground mt-2">
          Het coffeeshopregister is alleen beschikbaar voor het bestuur.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <button
          onClick={() => navigate("/coffeeshopregister")}
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
        >
          <ArrowLeft size={14} /> Coffeeshopregister
        </button>
        <h1 className="font-display text-2xl sm:text-3xl uppercase flex items-center gap-2">
          <MapPin className="text-brand-red" /> {decoded}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registershops in deze gemeente, onze koppelingen en de dossiers die we buiten de telling houden.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Actieve registershops", value: data.actief.length },
          { label: "Gekoppeld aan een lid", value: data.bevestigd },
          { label: "Vertegenwoordigd", value: data.vertegenwoordigd },
          { label: "Dekking", value: `${data.pct}%` },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-display tabular-nums mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Register laden…</p>}

      {/* Registershops */}
      <section className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-display uppercase text-sm flex items-center gap-2">
            <Building2 size={16} className="text-brand-red" /> Registershops in {decoded}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {data.actief.length} actieve dossiers uit het landelijke register
          </p>
        </div>
        <div className="divide-y">
          {data.actief.map((s) => {
            const link = linkByShop.get(s.id);
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{s.naam}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {shopAdres(s)}
                    {s.vergunninghouder ? ` · ${s.vergunninghouder}` : ""}
                  </p>
                </div>
                {link?.status === "bevestigd" ? (
                  <Link to={`/leden/${link.member_id}`} className="shrink-0">
                    <Badge>{memberNaam.get(link.member_id) ?? `Lid #${link.member_id}`}</Badge>
                  </Link>
                ) : link?.status === "voorstel" ? (
                  <Badge variant="secondary" className="shrink-0">
                    Voorstel: {memberNaam.get(link.member_id) ?? `Lid #${link.member_id}`}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0">
                    Niet gekoppeld
                  </Badge>
                )}
              </div>
            );
          })}
          {!data.actief.length && !isLoading && (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Geen actieve registershops in deze gemeente.
            </p>
          )}
        </div>
      </section>

      {/* Ledenlocaties zonder registerkoppeling */}
      <section className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-display uppercase text-sm">Ledenlocaties zonder registerkoppeling</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tellen wel mee als vertegenwoordigde coffeeshop, maar hangen nog niet aan een registerdossier.
          </p>
        </div>
        <div className="divide-y">
          {data.zonderKoppeling.map((l, i) => (
            <div key={`${l.memberId}-${i}`} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{l.naam}</p>
                <p className="text-xs text-muted-foreground truncate">{l.adres || "Geen adres bekend"}</p>
              </div>
              <Link to={`/leden/${l.memberId}`} className="shrink-0">
                <Badge variant="outline">{l.memberNaam}</Badge>
              </Link>
            </div>
          ))}
          {!data.zonderKoppeling.length && (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Alle ledenlocaties in deze gemeente zijn aan het register gekoppeld.
            </p>
          )}
        </div>
        {data.gekoppeldZonderVestiging.length > 0 && (
          <div className="border-t bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            {data.gekoppeldZonderVestiging.length} koppeling(en) in deze gemeente konden niet aan een
            specifieke vestiging van het lid worden toegewezen:{" "}
            {data.gekoppeldZonderVestiging.map((l) => l.naam).join(", ")}.
          </div>
        )}
      </section>

      {/* Uitgesloten dossiers */}
      <section className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="font-display uppercase text-sm flex items-center gap-2">
            <MinusCircle size={16} className="text-brand-red" /> Uitgesloten dossiers
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Registerrijen die niet meetellen: ruis, vervallen dossiers en gesloten shops.
          </p>
        </div>
        <div className="divide-y">
          {data.uitgesloten.map((s) => (
            <div key={s.id} className="px-4 py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium min-w-0 flex-1 truncate">{s.naam}</p>
                <Badge variant="secondary" className="shrink-0">
                  {s.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{shopAdres(s) || "Geen adres bekend"}</p>
              <p className="text-xs text-destructive mt-0.5">{exclusionReason(s)}</p>
            </div>
          ))}
          {!data.uitgesloten.length && (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Geen uitgesloten dossiers in deze gemeente.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

export default RegisterGemeenteDetailPage;
