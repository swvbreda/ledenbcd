import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMembersData } from "@/contexts/MembersDataContext";
import {
  useRegisterLinks,
  useRegisterUbo,
  useSetRegisterLink,
  type RegisterShop,
} from "@/hooks/useCoffeeshopRegister";
import { statusLabel } from "@/lib/registerActive";

const Row = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="flex justify-between gap-4 py-1.5 border-b last:border-0 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{value || "—"}</span>
  </div>
);

const CoffeeshopRegisterDetailDialog = ({
  shop,
  open,
  onOpenChange,
}: {
  shop: RegisterShop | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const { data: ubo = [] } = useRegisterUbo(shop?.id ?? null);
  const { data: links = [] } = useRegisterLinks(!!shop);
  const { rawMembers } = useMembersData();
  const setLink = useSetRegisterLink();
  const [zoek, setZoek] = useState("");

  const link = links.find((l) => l.register_id === shop?.id && l.status !== "afgewezen");
  const gekoppeldLid = rawMembers.find((m) => m.id === link?.member_id);

  const kandidaten = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    if (!q) return [];
    return rawMembers
      .filter((m) => (m.naam ?? "").toLowerCase().includes(q) || String(m.id).includes(q))
      .slice(0, 8);
  }, [zoek, rawMembers]);

  if (!shop) return null;

  const adres = [
    [shop.straat, shop.huisnummer, shop.huisnummer_toevoeging].filter(Boolean).join(" "),
    [shop.postcode, shop.plaats].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {shop.logo_url && (
              <img
                src={shop.logo_url}
                alt={`Logo ${shop.naam}`}
                loading="lazy"
                className="h-12 w-12 rounded-md border border-border object-contain bg-background"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div className="min-w-0">
              <DialogTitle className="font-display uppercase">{shop.naam}</DialogTitle>
              <DialogDescription>
                {shop.gemeente ? `Gemeente ${shop.gemeente}` : "Coffeeshopregister"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-2">Vestiging</h3>
            <Row label="Adres" value={adres} />
            <Row label="Gemeente" value={shop.gemeente} />
            <Row label="Provincie" value={shop.provincie} />
            <Row label="Telefoon" value={shop.telefoon} />
            <Row label="Website" value={shop.website} />
            <Row label="Shopcode" value={shop.shopcode} />
            <Row
              label="Opgericht"
              value={shop.oprichtingsdatum ? new Date(shop.oprichtingsdatum).toLocaleDateString("nl-NL") : null}
            />
            <Row label="Instagram" value={shop.socials?.instagram} />
            <Row label="Facebook" value={shop.socials?.facebook} />
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-2">Vergunning</h3>
            <Row label="Vergunninghouder" value={shop.vergunninghouder} />
            <Row label="Exploitant" value={shop.exploitant} />
            <Row label="Vergunningnummer" value={shop.vergunningnummer} />
            <Row label="Status" value={statusLabel(shop.status)} />
            <Row
              label="Verleend"
              value={shop.vergunningverlening ? new Date(shop.vergunningverlening).toLocaleDateString("nl-NL") : null}
            />
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-2">Eigendomsketen</h3>
            {ubo.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nog geen eigendomsgegevens beschikbaar voor deze shop.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {ubo.map((u) => (
                  <li key={u.id} className="text-sm flex items-center gap-2">
                    <span className="text-muted-foreground w-6 tabular-nums">{u.niveau}.</span>
                    <span className="font-medium">{u.naam}</span>
                    {u.kvk_nummer && <span className="text-muted-foreground">KvK {u.kvk_nummer}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide mb-2">Koppeling met lid</h3>
            {link && gekoppeldLid ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge variant={link.status === "bevestigd" ? "default" : "secondary"}>
                    {link.status === "bevestigd" ? "Bevestigd" : "Voorstel"}
                  </Badge>
                  <Link to={`/leden/${gekoppeldLid.id}`} className="font-medium underline">
                    {gekoppeldLid.naam}
                  </Link>
                  {link.match_reden && (
                    <span className="text-xs text-muted-foreground">({link.match_reden})</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {link.status === "voorstel" && (
                    <Button
                      size="sm"
                      onClick={() =>
                        setLink.mutate({
                          register_id: shop.id,
                          member_id: link.member_id,
                          status: "bevestigd",
                          existingId: link.id,
                          previousStatus: "voorstel",
                        })
                      }
                    >
                      Bevestigen
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost">Ontkoppelen</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Koppeling verwijderen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {shop.naam} wordt ontkoppeld van {gekoppeldLid.naam}. Andere koppelingen en lidgegevens blijven behouden.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            setLink.mutate({
                              register_id: shop.id,
                              member_id: link.member_id,
                              status: "afgewezen",
                              existingId: link.id,
                            })
                          }
                        >
                          Ontkoppelen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder="Zoek een lid om te koppelen…"
                  value={zoek}
                  onChange={(e) => setZoek(e.target.value)}
                />
                {kandidaten.map((m) => (
                  <button
                    key={m.id}
                    className="w-full text-left px-3 py-2 rounded border hover:bg-muted/50 text-sm"
                    onClick={() => {
                      setLink.mutate({ register_id: shop.id, member_id: m.id, status: "bevestigd" });
                      setZoek("");
                    }}
                  >
                    {m.naam} <span className="text-muted-foreground">· {m.plaats}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CoffeeshopRegisterDetailDialog;
