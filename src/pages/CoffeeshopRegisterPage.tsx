import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, Check, Link2, RefreshCw, Search, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMembersData } from "@/contexts/MembersDataContext";
import {
  useCoffeeshopRegister,
  useRegisterLinks,
  useRegisterSyncState,
  useSetRegisterLink,
  useSyncRegister,
  type RegisterShop,
} from "@/hooks/useCoffeeshopRegister";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CoffeeshopRegisterDetailDialog from "@/components/register/CoffeeshopRegisterDetailDialog";
import RegisterEnrichmentPanel from "@/components/register/RegisterEnrichmentPanel";
import ConfirmLinkDialog from "@/components/register/ConfirmLinkDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { isActiveShop } from "@/lib/registerActive";

type Koppeling = "alle" | "lid" | "voorstel" | "geen";
type Vergunning = "vergund" | "alle";

const CoffeeshopRegisterPage = () => {
  const navigate = useNavigate();
  const { isAdmin, isBoard } = useAuth();
  const allowed = isAdmin || isBoard;

  const { data: shops = [], isLoading } = useCoffeeshopRegister(allowed);
  const { data: links = [] } = useRegisterLinks(allowed);
  const { data: syncState } = useRegisterSyncState(allowed);
  const syncRegister = useSyncRegister();
  const setLink = useSetRegisterLink();
  const { rawMembers } = useMembersData();

  const [search, setSearch] = useState("");
  const [gemeente, setGemeente] = useState("alle");
  const [koppeling, setKoppeling] = useState<Koppeling>("alle");
  const [detail, setDetail] = useState<RegisterShop | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    shop: RegisterShop;
    proposal: { linkId: string; memberId: number; reden: string | null; score: number | null } | null;
  } | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<{ shop: RegisterShop; linkId: string; memberId: number } | null>(null);

  const memberName = useMemo(() => {
    const map = new Map<number, string>();
    rawMembers.forEach((m) => map.set(m.id, m.naam || `Lid #${m.id}`));
    return map;
  }, [rawMembers]);

  const linkByShop = useMemo(() => {
    const map = new Map<
      string,
      { member_id: number; status: string; id: string; reden: string | null; score: number | null }
    >();
    links.forEach((l) => {
      if (l.status === "afgewezen") return;
      const current = map.get(l.register_id);
      if (!current || (current.status !== "bevestigd" && l.status === "bevestigd")) {
        map.set(l.register_id, {
          member_id: l.member_id,
          status: l.status,
          id: l.id,
          reden: l.match_reden,
          score: l.match_score ?? null,
        });
      }
    });
    return map;
  }, [links]);

  /** Vergunde shops: de basis voor alle cijfers op deze pagina. */
  const actief = useMemo(() => shops.filter(isActiveShop), [shops]);

  /** Zichtbare shops: standaard alleen vergund, optioneel alle niet-vervallen. */
  const zichtbaar = useMemo(
    () => (vergunning === "vergund" ? actief : shops.filter((s) => !s.vervallen)),
    [vergunning, actief, shops],
  );

  const gemeenten = useMemo(
    () => Array.from(new Set(zichtbaar.map((s) => s.gemeente).filter(Boolean) as string[])).sort(),
    [zichtbaar],
  );

  const gemeentenVergund = useMemo(
    () => new Set(actief.map((s) => s.gemeente).filter(Boolean) as string[]).size,
    [actief],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return zichtbaar.filter((s) => {
      if (gemeente !== "alle" && s.gemeente !== gemeente) return false;
      const link = linkByShop.get(s.id);
      if (koppeling === "lid" && link?.status !== "bevestigd") return false;
      if (koppeling === "voorstel" && link?.status !== "voorstel") return false;
      if (koppeling === "geen" && link) return false;
      if (!q) return true;
      return [s.naam, s.plaats, s.gemeente, s.straat, s.vergunninghouder, s.exploitant]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [zichtbaar, search, gemeente, koppeling, linkByShop]);

  const bevestigd = useMemo(
    () => actief.filter((s) => linkByShop.get(s.id)?.status === "bevestigd").length,
    [actief, linkByShop],
  );
  const voorstellen = useMemo(
    () => actief.filter((s) => linkByShop.get(s.id)?.status === "voorstel").length,
    [actief, linkByShop],
  );


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
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
          >
            <ArrowLeft size={14} /> Terug
          </button>
          <h1 className="font-display text-2xl sm:text-3xl uppercase flex items-center gap-2">
            <Building2 className="text-brand-red" /> Coffeeshopregister
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Landelijk register van coffeeshops, gekoppeld aan het ledenbestand. Alleen zichtbaar voor het bestuur.
          </p>
        </div>
        {isAdmin && (
          <div className="text-right space-y-1">
            <Button
              variant="outline"
              onClick={() => syncRegister.mutate()}
              disabled={syncRegister.isPending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${syncRegister.isPending ? "animate-spin" : ""}`} />
              Register synchroniseren
            </Button>
            {syncState?.last_run_at && (
              <p className="text-xs text-muted-foreground">
                Laatste sync: {new Date(syncState.last_run_at).toLocaleString("nl-NL")} · {syncState.last_status}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Coffeeshops in NL", value: actief.length },
          { label: "Gekoppeld aan leden", value: bevestigd },
          { label: "Voorstellen te bevestigen", value: voorstellen },
          { label: "Gemeenten", value: gemeenten.length },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</p>
            <p className="text-2xl font-display tabular-nums mt-1">{k.value}</p>
          </div>
        ))}
      </div>

      <RegisterEnrichmentPanel memberName={memberName} isAdmin={isAdmin} />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Zoek op naam, plaats of vergunninghouder"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={gemeente} onValueChange={setGemeente}>
          <SelectTrigger className="sm:w-56"><SelectValue placeholder="Gemeente" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="alle">Alle gemeenten</SelectItem>
            {gemeenten.map((g) => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={koppeling} onValueChange={(v) => setKoppeling(v as Koppeling)}>
          <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle shops</SelectItem>
            <SelectItem value="lid">Aangesloten leden</SelectItem>
            <SelectItem value="voorstel">Voorstellen</SelectItem>
            <SelectItem value="geen">Niet gekoppeld</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Coffeeshop</th>
                <th className="px-3 py-2 font-medium">Plaats</th>
                <th className="px-3 py-2 font-medium hidden md:table-cell">Vergunninghouder</th>
                <th className="px-3 py-2 font-medium">Lid</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Laden…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Geen resultaten</td></tr>
              )}
              {filtered.map((s) => {
                const link = linkByShop.get(s.id);
                return (
                  <tr
                    key={s.id}
                    className="border-t hover:bg-muted/30 cursor-pointer"
                    onClick={() => setDetail(s)}
                  >
                    <td className="px-3 py-2 font-medium">{s.naam}</td>
                    <td className="px-3 py-2">{s.plaats ?? "—"}</td>
                    <td className="px-3 py-2 hidden md:table-cell text-muted-foreground">
                      {s.vergunninghouder ?? s.exploitant ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {link ? (
                        <div className="space-y-0.5">
                          <Badge variant={link.status === "bevestigd" ? "default" : "secondary"}>
                            {memberName.get(link.member_id) ?? `Lid #${link.member_id}`}
                            {link.status === "voorstel" && " (voorstel)"}
                          </Badge>
                          {link.status === "voorstel" && (
                            <p
                              className={`text-xs ${
                                (link.score ?? 0) < 0.7
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {link.reden ?? "onbekende reden"}
                              {link.score != null && ` · ${Math.round(link.score * 100)}%`}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {link?.status === "voorstel" && (
                        <span className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setConfirmTarget({
                                shop: s,
                                proposal: {
                                  linkId: link.id,
                                  memberId: link.member_id,
                                  reden: link.reden,
                                  score: link.score,
                                },
                              })
                            }
                          >
                            <Check className="mr-1 h-4 w-4" /> Controleren
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setLink.mutate({
                                register_id: s.id,
                                member_id: link.member_id,
                                status: "afgewezen",
                                existingId: link.id,
                              })
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </span>
                      )}
                      {!link && (
                        <span onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConfirmTarget({ shop: s, proposal: null })}
                          >
                            <Link2 className="mr-1 h-4 w-4" /> Koppel aan lid
                          </Button>
                        </span>
                      )}
                      {link?.status === "bevestigd" && (
                        <span onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setUnlinkTarget({ shop: s, linkId: link.id, memberId: link.member_id })}
                          >
                            <X className="mr-1 h-4 w-4" />
                            Ontkoppelen
                          </Button>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmLinkDialog
        shop={confirmTarget?.shop ?? null}
        proposal={confirmTarget?.proposal ?? null}
        open={!!confirmTarget}
        onOpenChange={(o) => !o && setConfirmTarget(null)}
      />

      <CoffeeshopRegisterDetailDialog
        shop={detail}
        open={!!detail}
        onOpenChange={(o) => !o && setDetail(null)}
      />

      <AlertDialog open={!!unlinkTarget} onOpenChange={(open) => !open && setUnlinkTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Koppeling verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {unlinkTarget
                ? `${unlinkTarget.shop.naam} wordt ontkoppeld van ${memberName.get(unlinkTarget.memberId) ?? `lid #${unlinkTarget.memberId}`}. Andere koppelingen en lidgegevens blijven behouden.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!unlinkTarget) return;
                setLink.mutate({
                  register_id: unlinkTarget.shop.id,
                  member_id: unlinkTarget.memberId,
                  status: "afgewezen",
                  existingId: unlinkTarget.linkId,
                });
                setUnlinkTarget(null);
              }}
            >
              Ontkoppelen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CoffeeshopRegisterPage;
