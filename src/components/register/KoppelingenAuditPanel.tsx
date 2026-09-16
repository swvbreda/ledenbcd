import { useMemo, useState } from "react";
import { AlertTriangle, Check, Link2, Merge, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { Member, Location } from "@/data/types";
import type { RegisterLink, RegisterShop } from "@/hooks/useCoffeeshopRegister";
import { useAssignLinkLocation } from "@/hooks/useCoffeeshopRegister";
import { useMergeDuplicateLocations } from "@/hooks/useKoppelingenAudit";
import { useMemberAffiliations, useSetAffiliation } from "@/hooks/useMemberAffiliations";
import { useDismissDuplicate, useDuplicateDismissals } from "@/hooks/useDuplicateDismissals";
import { locationKeyOf } from "@/lib/registerLocationMatch";
import { isActiveShop } from "@/lib/registerActive";

const compact = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const adresKey = (adres?: string | null, postcode?: string | null) =>
  `${compact(adres)}|${compact(postcode)}`;

const locatieOmschrijving = (loc: Location) =>
  [loc.naam, loc.adres, loc.plaats].filter(Boolean).join(" · ");

/** Lijken de namen genoeg op elkaar om het als dezelfde zaak te zien? */
const zelfdeNaam = (a?: string | null, b?: string | null) => {
  const x = compact(a);
  const y = compact(b);
  if (!x || !y) return true;
  return x === y || x.includes(y) || y.includes(x);
};

/** Hoeveel is er ingevuld bij deze vestiging? Bepaalt welke regel blijft staan. */
const volledigheid = (loc: Location) =>
  Object.values(loc ?? {}).filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
    .length;

type Props = {
  shops: RegisterShop[];
  links: RegisterLink[];
  members: Member[];
};

/**
 * Overzicht per coffeeshop van de koppeling met een lid, met daarboven de
 * gevallen die controle vragen. Hetzelfde adres is niet per se een fout:
 * gelieerde leden en overgenomen zaken mogen naast elkaar bestaan.
 */
const KoppelingenAuditPanel = ({ shops, links, members }: Props) => {
  const [zoek, setZoek] = useState("");
  const [toonAlles, setToonAlles] = useState(false);
  const mergeLocations = useMergeDuplicateLocations();
  const assignLocation = useAssignLinkLocation();
  const { data: affiliations } = useMemberAffiliations();
  const setAffiliation = useSetAffiliation();
  const { data: beoordeeld } = useDuplicateDismissals();
  const dismiss = useDismissDuplicate();

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const actieveShops = useMemo(() => shops.filter(isActiveShop), [shops]);

  const bevestigd = useMemo(
    () => links.filter((l) => l.status === "bevestigd"),
    [links],
  );

  const gelieerd = useMemo(() => {
    const set = new Set<string>();
    for (const a of affiliations ?? []) {
      set.add(`${a.member_id}-${a.related_member_id}`);
    }
    return set;
  }, [affiliations]);

  /** Alle vestigingen van alle leden, met hun sleutels. */
  const vestigingen = useMemo(() => {
    const list: Array<{ member: Member; loc: Location; key: string; adres: string }> = [];
    for (const m of members) {
      for (const loc of m.locaties ?? []) {
        list.push({
          member: m,
          loc,
          key: locationKeyOf(loc),
          adres: adresKey(loc.adres, loc.postcode),
        });
      }
    }
    return list;
  }, [members]);

  /** Vestigingen op hetzelfde adres, verdeeld over drie soorten gevallen. */
  const groepen = useMemo(() => {
    const groups = new Map<string, typeof vestigingen>();
    for (const v of vestigingen) {
      if (!compact(v.loc.adres)) continue;
      const list = groups.get(v.adres) ?? [];
      list.push(v);
      groups.set(v.adres, list);
    }
    const eenduidig: Array<{ key: string; adres: string; list: typeof vestigingen }> = [];
    const controleren: Array<{ key: string; adres: string; list: typeof vestigingen }> = [];
    const overLeden: Array<{ key: string; adres: string; list: typeof vestigingen }> = [];

    for (const [adres, list] of groups) {
      if (list.length < 2) continue;
      const lidIds = new Set(list.map((v) => v.member.id));
      if (lidIds.size === 1) {
        const key = `lid:${list[0]!.member.id}|${adres}`;
        if (beoordeeld?.has(key)) continue;
        const namenGelijk = list.every((v) => zelfdeNaam(v.loc.naam, list[0]!.loc.naam));
        const postcodesGelijk = new Set(list.map((v) => compact(v.loc.postcode))).size === 1;
        (namenGelijk && postcodesGelijk ? eenduidig : controleren).push({ key, adres, list });
        continue;
      }
      const ids = Array.from(lidIds).sort((a, b) => a - b);
      const key = `leden:${ids.join("-")}|${adres}`;
      if (beoordeeld?.has(key)) continue;
      // Gelieerde leden op hetzelfde adres zijn geen melding.
      const allesGelieerd = ids.every((a) => ids.every((b) => a === b || gelieerd.has(`${a}-${b}`)));
      if (allesGelieerd) continue;
      overLeden.push({ key, adres, list });
    }
    return { eenduidig, controleren, overLeden };
  }, [vestigingen, beoordeeld, gelieerd]);

  const { eenduidig, controleren, overLeden } = groepen;
  const teControleren = eenduidig.length + controleren.length + overLeden.length;

  /** Bevestigde koppelingen zonder vestiging, waarbij het lid maar één vestiging heeft. */
  const zonderVestiging = useMemo(() => {
    return bevestigd
      .filter((l) => !l.location_key)
      .map((l) => {
        const member = memberById.get(l.member_id);
        const locs = member?.locaties ?? [];
        const shop = shops.find((s) => s.id === l.register_id) ?? null;
        return { link: l, member, shop, locaties: locs };
      })
      .filter((r) => r.member);
  }, [bevestigd, memberById, shops]);

  const rijen = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    const linkByShop = new Map(bevestigd.map((l) => [l.register_id, l]));
    return actieveShops
      .map((s) => {
        const link = linkByShop.get(s.id) ?? null;
        const member = link ? memberById.get(link.member_id) ?? null : null;
        const loc =
          link?.location_key && member
            ? (member.locaties ?? []).find((l) => locationKeyOf(l) === link.location_key) ?? null
            : null;
        const probleem = link
          ? !link.location_key && (member?.locaties?.length ?? 0) > 1
            ? "Vestiging niet toegewezen"
            : null
          : null;
        return { shop: s, link, member, loc, probleem };
      })
      .filter((r) => {
        if (!toonAlles && !r.link) return false;
        if (!q) return true;
        return [r.shop.naam, r.shop.plaats, r.member?.naam, r.loc?.naam]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      })
      .sort((a, b) => a.shop.naam.localeCompare(b.shop.naam));
  }, [actieveShops, bevestigd, memberById, zoek, toonAlles]);

  const mergeGroep = (
    groep: { list: typeof vestigingen },
    keepKeyOverride?: string,
  ) => {
    const gesorteerd = [...groep.list].sort((a, b) => volledigheid(b.loc) - volledigheid(a.loc));
    const keep = keepKeyOverride
      ? gesorteerd.find((v) => v.key === keepKeyOverride) ?? gesorteerd[0]!
      : gesorteerd[0]!;
    const removeKeys = gesorteerd
      .filter((v) => v !== keep)
      .map((v) => v.key)
      .filter((k) => k !== keep.key);
    if (!removeKeys.length) return;
    mergeLocations.mutate({ memberId: keep.member.id, keepKey: keep.key, removeKeys });
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link2 className="h-4 w-4 text-brand-red" />
        <h2 className="font-display uppercase text-sm">Koppelingen per coffeeshop</h2>
        <Badge variant="secondary">{bevestigd.length} gekoppeld</Badge>
        {teControleren > 0 && <Badge variant="secondary">{teControleren} te controleren</Badge>}
      </div>

      {eenduidig.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-medium">
              Zelfde zaak twee keer bij hetzelfde lid ({eenduidig.length})
            </p>
            <Button
              size="sm"
              className="ml-auto"
              disabled={mergeLocations.isPending}
              onClick={() => eenduidig.forEach((g) => mergeGroep(g))}
            >
              <Merge className="mr-1 h-4 w-4" /> Alles samenvoegen
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Zelfde adres, zelfde postcode en dezelfde naam — dit kan veilig worden samengevoegd.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {eenduidig.map((g) => {
              const lid = g.list[0]!.member;
              return (
                <div key={g.key} className="rounded-md border bg-card p-3 space-y-2">
                  <p className="font-medium">{lid.naam}</p>
                  <ul className="text-sm text-muted-foreground space-y-0.5">
                    {g.list.map((v, i) => (
                      <li key={`${v.key}-${i}`}>{locatieOmschrijving(v.loc)}</li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mergeLocations.isPending}
                      onClick={() => mergeGroep(g)}
                    >
                      <Merge className="mr-1 h-4 w-4" /> Samenvoegen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => dismiss.mutate({ key: g.key, reden: "twee zaken" })}
                    >
                      <X className="mr-1 h-4 w-4" /> Dit zijn twee zaken
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {controleren.length > 0 && (
        <div className="rounded-md border p-3 space-y-3">
          <p className="text-sm font-medium">
            Zelfde adres bij één lid, andere naam of postcode ({controleren.length})
          </p>
          <p className="text-xs text-muted-foreground">
            Bijvoorbeeld een overgenomen of hernoemde zaak. Kies welke regel blijft staan — de
            gegevens van de andere regel worden daarbij aangevuld.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {controleren.map((g) => (
              <div key={g.key} className="rounded-md border bg-card p-3 space-y-2">
                <p className="font-medium">{g.list[0]!.member.naam}</p>
                <ul className="space-y-1">
                  {g.list.map((v, i) => (
                    <li key={`${v.key}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-muted-foreground">{locatieOmschrijving(v.loc)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={mergeLocations.isPending}
                        onClick={() => mergeGroep(g, v.key)}
                      >
                        Deze houden
                      </Button>
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => dismiss.mutate({ key: g.key, reden: "twee zaken" })}
                >
                  <X className="mr-1 h-4 w-4" /> Dit zijn twee zaken
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {overLeden.length > 0 && (
        <div className="rounded-md border p-3 space-y-3">
          <p className="text-sm font-medium">
            Zelfde adres bij verschillende leden ({overLeden.length})
          </p>
          <p className="text-xs text-muted-foreground">
            Dit hoeft niet fout te zijn: leden met dezelfde eigenaren of hetzelfde pand hebben vaak
            een eigen lidmaatschap. Leg ze vast als gelieerd, dan verdwijnt deze melding.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {overLeden.map((g) => {
              const ids = Array.from(new Set(g.list.map((v) => v.member.id)));
              return (
                <div key={g.key} className="rounded-md border bg-card p-3 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {g.list[0]!.loc.adres} · {g.list[0]!.loc.plaats}
                  </p>
                  <ul className="space-y-1">
                    {g.list.map((v, i) => (
                      <li key={`${v.member.id}-${v.key}-${i}`} className="text-sm">
                        <span className="font-medium">{v.member.naam}</span>{" "}
                        <span className="text-muted-foreground">— {v.loc.naam}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={setAffiliation.isPending}
                      onClick={() => setAffiliation.mutate({ memberIds: ids })}
                    >
                      <Users className="mr-1 h-4 w-4" /> Gelieerde leden
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => dismiss.mutate({ key: g.key, reden: "klopt" })}
                    >
                      <Check className="mr-1 h-4 w-4" /> Dit klopt
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {zonderVestiging.length > 0 && (
        <div className="rounded-md border p-3 space-y-3">
          <p className="text-sm font-medium">
            Koppelingen zonder vestiging ({zonderVestiging.length})
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {zonderVestiging.map((r) => {
              const eenduidig = r.locaties.length === 1;
              return (
                <div key={r.link.id} className="rounded-md border bg-card p-3 space-y-2">
                  <p className="font-medium">{r.shop?.naam ?? "Onbekende coffeeshop"}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.member?.naam} · {r.locaties.length} vestiging
                    {r.locaties.length === 1 ? "" : "en"}
                  </p>
                  {eenduidig ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={assignLocation.isPending}
                      onClick={() =>
                        assignLocation.mutate({
                          linkId: r.link.id,
                          location_key: locationKeyOf(r.locaties[0]!),
                        })
                      }
                    >
                      <Check className="mr-1 h-4 w-4" /> Koppel aan{" "}
                      {r.locaties[0]!.naam || "de vestiging"}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Meerdere vestigingen — kies de juiste in het detailscherm van de coffeeshop.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Zoek op coffeeshop, plaats of lid"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => setToonAlles((v) => !v)}>
          {toonAlles ? "Alleen gekoppelde shops" : "Ook niet-gekoppelde shops"}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pr-3">Coffeeshop</th>
              <th className="py-2 pr-3">Plaats</th>
              <th className="py-2 pr-3">Lid</th>
              <th className="py-2 pr-3">Vestiging</th>
            </tr>
          </thead>
          <tbody>
            {rijen.map((r) => (
              <tr key={r.shop.id} className="border-t">
                <td className="py-2 pr-3 font-medium">{r.shop.naam}</td>
                <td className="py-2 pr-3 text-muted-foreground">{r.shop.plaats}</td>
                <td className="py-2 pr-3">
                  {r.member ? r.member.naam : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="py-2 pr-3">
                  {r.loc ? (
                    r.loc.naam || r.loc.adres
                  ) : r.probleem ? (
                    <Badge variant="destructive">{r.probleem}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rijen.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-muted-foreground">
                  Geen coffeeshops gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default KoppelingenAuditPanel;
