import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, RefreshCw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  EnrichmentProposal,
  useEnrichmentContext,
  useEnrichmentProposals,
  useResolveProposal,
  useRunEnrichment,
} from "@/hooks/useCoffeeshopRegister";
import { describeLocation, findMemberLocation } from "@/lib/registerLocationMatch";

const FIELD_LABELS: Record<string, string> = {
  adres: "Adres",
  postcode: "Postcode",
  plaats: "Plaats",
  gemeente: "Gemeente",
  stadsdeel: "Stadsdeel",
  oprichtingsDatum: "Oprichtingsdatum",
  kvk: "KvK-nummer",
  website: "Website",
  telefoon: "Telefoon",
  bedrijfsnaam: "Bedrijfsnaam",
  vergunninghouder: "Vergunninghouder (B.V.)",
  exploitant: "Exploitant",

};

/** Velden die als terugval de facturatiegegevens bepalen. */
const INVOICE_SENSITIVE = new Set(["bedrijfsnaam", "kvk"]);

const fieldLabel = (f: string) => FIELD_LABELS[f] ?? f;

type Props = {
  memberName: Map<number, string>;
  isAdmin: boolean;
};

type Group = {
  key: string;
  isLocation: boolean;
  title: string;
  subtitle: string;
  registerLine: string | null;
  matched: boolean;
  changeKind: "move" | "correction" | null;
  items: EnrichmentProposal[];
};

/** Adres- en postcodewijzigingen van een gekoppelde vestiging = verhuizing. */
const MOVE_FIELDS = new Set(["adres", "postcode"]);

const normalizeValue = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

/** Alleen schrijfwijze verschilt (spaties/leestekens) = adrescorrectie, geen verhuizing. */
const isCosmeticChange = (current: unknown, proposed: unknown) => {
  const a = normalizeValue(current);
  const b = normalizeValue(proposed);
  return !!a && a === b;
};


const RegisterEnrichmentPanel = ({ memberName, isAdmin }: Props) => {
  const { data: proposals = [], isLoading } = useEnrichmentProposals();
  const resolve = useResolveProposal();
  const run = useRunEnrichment();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const memberIds = useMemo(() => proposals.map((p) => p.member_id), [proposals]);
  const registerIds = useMemo(
    () => proposals.map((p) => p.register_id).filter((v): v is string => !!v),
    [proposals],
  );
  const { data: ctx } = useEnrichmentContext(memberIds, registerIds, open);

  const grouped = useMemo(() => {
    const byMember = new Map<number, EnrichmentProposal[]>();
    for (const p of proposals) {
      const arr = byMember.get(p.member_id) ?? [];
      arr.push(p);
      byMember.set(p.member_id, arr);
    }

    return Array.from(byMember.entries()).map(([memberId, items]) => {
      const locaties = ctx?.locaties.get(memberId) ?? [];
      const groups = new Map<string, Group>();

      for (const p of items) {
        const isLocation = p.scope === "locatie";
        // Groepeer per registervestiging: de locatiesleutel kan na een
        // verhuizing verschuiven en zou de vestiging anders opsplitsen.
        const key = isLocation ? `loc:${p.register_id ?? p.location_key ?? "?"}` : "algemeen";
        let group = groups.get(key);
        if (!group) {
          const shop = p.register_id ? ctx?.shops.get(p.register_id) : undefined;
          const oldPostcode = items.find(
            (candidate) =>
              candidate.scope === "locatie" &&
              candidate.register_id === p.register_id &&
              candidate.location_key === p.location_key &&
              candidate.field === "postcode",
          )?.current_value;
          const loc = isLocation
            ? findMemberLocation(locaties, p.location_key, shop, [oldPostcode])
            : null;
          const shopAddress = shop
            ? [
                [shop.straat, shop.huisnummer, shop.huisnummer_toevoeging]
                  .filter(Boolean)
                  .join(" ")
                  .trim(),
                shop.postcode,
                shop.plaats,
              ]
                .filter(Boolean)
                .join(", ")
            : "";
          group = {
            key,
            isLocation,
            title: isLocation
              ? loc?.naam || shop?.naam || `Locatie ${p.location_key ?? ""}`
              : "Algemene ledengegevens",
            subtitle: isLocation
              ? describeLocation(loc) || shopAddress
              : shop
                ? "Afkomstig uit één vestiging — zie registerregel"
                : "Geldt voor het hele lid",
            registerLine: shop
              ? `Register: ${shop.naam}${shopAddress ? ` — ${shopAddress}` : ""}${
                  shop.vergunninghouder ? ` — ${shop.vergunninghouder}` : ""
                }`
              : null,
            matched: isLocation ? !!loc : true,
            changeKind: null,

            items: [],
          };
          groups.set(key, group);
        }
        group.items.push(p);
      }

      for (const group of groups.values()) {
        const addressItems = group.isLocation
          ? group.items.filter((p) => MOVE_FIELDS.has(p.field))
          : [];
        group.changeKind = addressItems.length
          ? addressItems.every((p) => isCosmeticChange(p.current_value, p.proposed_value))
            ? "correction"
            : "move"
          : null;
        // Adres eerst, dan postcode: zo blijft de vestiging steeds vindbaar.
        group.items.sort(
          (a, b) => (a.field === "adres" ? -1 : 0) - (b.field === "adres" ? -1 : 0),
        );
      }

      return {
        memberId,
        memberLabel: memberName.get(memberId) ?? `Lid #${memberId}`,
        groups: Array.from(groups.values()),
      };
    });

  }, [proposals, ctx, memberName]);

  const applyGroup = async (group: Group, apply: boolean) => {
    setBusy(true);
    try {
      for (const p of group.items) {
        if (apply && !group.matched) continue;
        await resolve.mutateAsync({ proposal: p, apply });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 p-4 flex-wrap">
        <button
          className="flex items-center gap-2 text-left"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Sparkles className="h-4 w-4 text-brand-red" />
          <span className="font-medium">Aanvullingen vanuit het register</span>
          <Badge variant={proposals.length ? "default" : "secondary"}>
            {isLoading ? "…" : proposals.length}
          </Badge>
        </button>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => run.mutate()} disabled={run.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${run.isPending ? "animate-spin" : ""}`} />
            Ledengegevens aanvullen
          </Button>
        )}
      </div>

      {open && (
        <div className="border-t divide-y">
          {proposals.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Geen openstaande afwijkingen. Lege velden en ontbrekende locaties zijn automatisch
              aangevuld vanuit het register.
            </p>
          )}
          {grouped.map(({ memberId, memberLabel, groups }) => (
            <div key={memberId} className="px-4 py-3 space-y-3">
              <p className="font-medium text-sm">{memberLabel}</p>

              {groups.map((group) => (
                <div key={group.key} className="rounded-lg border">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {group.title}
                        {group.isMove && (
                          <Badge className="ml-2 align-middle" variant="default">
                            Verhuizing
                          </Badge>
                        )}
                      </p>

                      {group.subtitle && (
                        <p className="text-xs text-muted-foreground break-words">{group.subtitle}</p>
                      )}
                      {group.registerLine && (
                        <p className="text-xs text-muted-foreground break-words">
                          {group.registerLine}
                        </p>
                      )}
                      {!group.matched && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          Locatie niet teruggevonden bij dit lid — overnemen niet mogelijk
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || !group.matched}
                        onClick={() => void applyGroup(group, true)}
                      >
                        {group.isMove ? "Verhuizing overnemen" : "Alles overnemen"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => applyGroup(group, false)}
                      >
                        Alles negeren
                      </Button>
                    </div>
                  </div>

                  <div className="divide-y">
                    {group.items.map((p) => (
                      <div key={p.id} className="flex items-start gap-3 p-3 text-sm">
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{fieldLabel(p.field)}</span>
                            <Badge variant="secondary">
                              {p.source === "kvk-vestiging"
                                ? "KvK-vestiging"
                                : p.source === "kvk"
                                  ? "KvK"
                                  : "Register"}
                            </Badge>
                            {INVOICE_SENSITIVE.has(p.field) && p.scope !== "locatie" && (
                              <Badge variant="destructive">beïnvloedt facturatie</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 break-words">
                            <span className="text-muted-foreground line-through">
                              {p.current_value || "—"}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-medium">{p.proposed_value}</span>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || resolve.isPending || !group.matched}
                            onClick={() => resolve.mutate({ proposal: p, apply: true })}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy || resolve.isPending}
                            onClick={() => resolve.mutate({ proposal: p, apply: false })}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RegisterEnrichmentPanel;
