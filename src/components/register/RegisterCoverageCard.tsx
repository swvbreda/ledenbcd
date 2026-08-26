import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Link2, MinusCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useMergedMembers } from "@/hooks/useMemberEdits";
import { useCoffeeshopRegister, useRegisterLinks, type RegisterShop } from "@/hooks/useCoffeeshopRegister";
import { useRegisterLinkSummary, useRegisterStats } from "@/hooks/useRegisterStats";
import { isRealLocation, memberLocationCount } from "@/lib/locationCount";
import { getGemeente, getLocationGemeente } from "@/data/gemeenteMapping";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ConfirmLinkDialog from "@/components/register/ConfirmLinkDialog";

const norm = (v?: string | null) => (v ?? "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");

export const locationKey = (loc: { naam?: string; adres?: string; postcode?: string; plaats?: string }) =>
  [norm(loc.naam), norm(loc.adres), norm(loc.postcode)].join("|");

type OpenLocation = {
  memberId: number;
  memberNaam: string;
  locNaam: string;
  adres: string;
  plaats: string;
  postcode: string;
  key: string;
  gemeente: string;
};

function useLocationStatuses(enabled: boolean) {
  return useQuery({
    queryKey: ["member-location-register-status"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_location_register_status" as any)
        .select("member_id, location_key, status");
      if (error) throw error;
      return (data ?? []) as unknown as { member_id: number; location_key: string; status: string }[];
    },
  });
}

function useMarkNotInRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { member_id: number; location_key: string; remove?: boolean }) => {
      if (input.remove) {
        const { error } = await supabase
          .from("member_location_register_status" as any)
          .delete()
          .eq("member_id", input.member_id)
          .eq("location_key", input.location_key);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("member_location_register_status" as any).upsert(
        { member_id: input.member_id, location_key: input.location_key, status: "niet_in_register" },
        { onConflict: "member_id,location_key" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["member-location-register-status"] });
      toast.success("Locatie gemarkeerd");
    },
    onError: (e: any) => toast.error(e.message ?? "Opslaan mislukt"),
  });
}

const RegisterCoverageCard = () => {
  const { isAdmin, isBoard } = useAuth();
  const allowed = isAdmin || isBoard;
  const { allRepresented } = useMembersData();
  const { members: represented } = useMergedMembers(allRepresented);
  const { data: summary } = useRegisterLinkSummary();
  const representation = useRegisterStats();
  const { data: shops = [] } = useCoffeeshopRegister(allowed);
  const { data: links = [] } = useRegisterLinks(allowed);
  const { data: statuses = [] } = useLocationStatuses(allowed);
  const markStatus = useMarkNotInRegister();

  const [open, setOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<{ shop: RegisterShop; memberId: number; locationKey: string } | null>(null);
  const [shopQuery, setShopQuery] = useState<Record<string, string>>({});

  const totalLocations = representation.totaalRepresented || represented.reduce((s, m) => s + memberLocationCount(m), 0);
  const linked = summary?.bevestigde_koppelingen ?? 0;

  const statusKeys = useMemo(
    () => new Set(statuses.map((s) => `${s.member_id}::${s.location_key}`)),
    [statuses],
  );

  const shopById = useMemo(() => new Map(shops.map((s) => [s.id, s])), [shops]);

  /** Ledenlocaties die (nog) geen bevestigde registerkoppeling hebben */
  const openLocations: OpenLocation[] = useMemo(() => {
    if (!allowed) return [];
    const confirmedByMember = new Map<number, RegisterShop[]>();
    for (const l of links) {
      if (l.status !== "bevestigd") continue;
      const shop = shopById.get(l.register_id);
      if (!shop) continue;
      const arr = confirmedByMember.get(l.member_id) ?? [];
      arr.push(shop);
      confirmedByMember.set(l.member_id, arr);
    }

    const out: OpenLocation[] = [];
    for (const m of represented) {
      const locs = (m.locaties ?? []).filter(isRealLocation);
      const shopsForMember = [...(confirmedByMember.get(m.id) ?? [])];
      const rest = locs.filter((l) => {
        const idx = shopsForMember.findIndex(
          (s) =>
            (norm(s.postcode) && norm(s.postcode) === norm(l.postcode)) ||
            norm(s.naam) === norm(l.naam),
        );
        const useIdx = idx >= 0 ? idx : shopsForMember.length ? 0 : -1;
        if (useIdx >= 0) {
          shopsForMember.splice(useIdx, 1);
          return false;
        }
        return true;
      });
      for (const l of rest) {
        const key = locationKey(l);
        if (statusKeys.has(`${m.id}::${key}`)) continue;
        out.push({
          memberId: m.id,
          memberNaam: m.naam,
          locNaam: l.naam || m.naam,
          adres: l.adres ?? "",
          plaats: l.plaats || m.plaats || "",
          postcode: l.postcode ?? "",
          key,
          gemeente: getLocationGemeente(l, m.plaats),
        });
      }
    }
    return out.sort((a, b) => a.memberNaam.localeCompare(b.memberNaam));
  }, [allowed, links, shopById, represented, statusKeys]);

  const teKoppelen = allowed ? openLocations.length : representation.nietGekoppeldeLocaties;
  const gemarkeerd = statuses.length;
  const sluitend = teKoppelen === 0;

  const suggestions = (loc: OpenLocation): RegisterShop[] => {
    const q = (shopQuery[`${loc.memberId}::${loc.key}`] ?? "").trim().toLowerCase();
    const linkedIds = new Set(links.filter((l) => l.status === "bevestigd").map((l) => l.register_id));
    const pool = shops.filter((s) => !s.vervallen && !linkedIds.has(s.id));
    if (q) {
      return pool
        .filter((s) => [s.naam, s.plaats, s.postcode].some((v) => (v ?? "").toLowerCase().includes(q)))
        .slice(0, 6);
    }
    return pool
      .filter((s) => getGemeente(s.gemeente || s.plaats || "") === loc.gemeente)
      .sort((a, b) => {
        const score = (s: RegisterShop) =>
          (norm(s.postcode) && norm(s.postcode) === norm(loc.postcode) ? 2 : 0) +
          (norm(s.naam) === norm(loc.locNaam) ? 2 : 0) +
          (norm(s.naam).includes(norm(loc.locNaam)) ? 1 : 0);
        return score(b) - score(a);
      })
      .slice(0, 6);
  };

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          {sluitend ? (
            <Check className="h-5 w-5 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          )}
          <div>
            <h3 className="font-display text-sm uppercase tracking-wide">Aansluiting op het register</h3>
            <p className="text-sm text-muted-foreground">
              <span className="tabular-nums font-medium text-foreground">{totalLocations}</span>{" "}
              vertegenwoordigde locaties ·{" "}
              <span className="tabular-nums font-medium text-foreground">{linked}</span> gekoppeld ·{" "}
              <span className="tabular-nums font-medium text-foreground">{teKoppelen}</span> te koppelen
              {gemarkeerd > 0 && ` · ${gemarkeerd} niet in register`}
              {representation.koppelingenZonderVestiging > 0 && ` · ${representation.koppelingenZonderVestiging} zonder vestiging`}
            </p>
          </div>
        </div>
        {allowed && (
          <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
            {open ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
            {open ? "Verbergen" : "Controleren"}
          </Button>
        )}
      </div>

      {allowed && open && (
        <div className="border-t p-4 space-y-3">
          {summary && summary.vervallen_koppelingen > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Let op: {summary.vervallen_koppelingen} bevestigde koppeling(en) verwijzen naar een vervallen
              registervermelding.
            </p>
          )}
          {openLocations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Alle vertegenwoordigde locaties zijn gekoppeld of gemarkeerd als niet in het register.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {openLocations.map((loc) => {
                const qKey = `${loc.memberId}::${loc.key}`;
                return (
                  <div key={qKey} className="p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm">
                        <span className="font-medium">{loc.locNaam}</span>{" "}
                        <span className="text-muted-foreground">
                          · {loc.adres || "—"} · {loc.plaats || "—"} · lid #{loc.memberId} {loc.memberNaam}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={markStatus.isPending}
                        onClick={() =>
                          markStatus.mutate({ member_id: loc.memberId, location_key: loc.key })
                        }
                      >
                        <MinusCircle className="mr-1 h-4 w-4" /> Niet in register
                      </Button>
                    </div>
                    <input
                      className="w-full rounded-md border px-3 py-1.5 text-sm bg-background"
                      placeholder="Zoek registershop op naam, plaats of postcode…"
                      value={shopQuery[qKey] ?? ""}
                      onChange={(e) => setShopQuery((s) => ({ ...s, [qKey]: e.target.value }))}
                    />
                    <div className="flex flex-wrap gap-2">
                      {suggestions(loc).map((s) => (
                        <Button
                          key={s.id}
                          variant="outline"
                          size="sm"
                          onClick={() => setLinkTarget({ shop: s, memberId: loc.memberId, locationKey: loc.key })}
                        >
                          <Link2 className="mr-1 h-3.5 w-3.5" />
                          {s.naam}
                          <Badge variant="secondary" className="ml-2">
                            {s.plaats}
                          </Badge>
                        </Button>
                      ))}
                      {suggestions(loc).length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          Geen vrije registershop gevonden in {loc.gemeente || "deze gemeente"}.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <ConfirmLinkDialog
        shop={linkTarget?.shop ?? null}
        presetMemberId={linkTarget?.memberId ?? null}
        presetLocationKey={linkTarget?.locationKey ?? null}
        open={!!linkTarget}
        onOpenChange={(o) => !o && setLinkTarget(null)}
      />
    </div>
  );
};

export default RegisterCoverageCard;
