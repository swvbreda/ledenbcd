import { useMemo, useState } from "react";
import { Check, X, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMembersData } from "@/contexts/MembersDataContext";
import { useSetRegisterLink, type RegisterShop } from "@/hooks/useCoffeeshopRegister";
import type { Member } from "@/data/types";

const norm = (v?: string | null) =>
  (v ?? "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");

const Row = ({
  label,
  left,
  right,
  compare = true,
}: {
  label: string;
  left?: string | null;
  right?: string | null;
  compare?: boolean;
}) => {
  const both = !!left && !!right;
  const match = both && norm(left) === norm(right);
  return (
    <div className="grid grid-cols-[7rem_1fr_1fr] gap-2 py-1.5 text-sm border-b last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium break-words">{left || "—"}</span>
      <span
        className={
          compare && both
            ? match
              ? "text-emerald-700 dark:text-emerald-400 font-medium break-words"
              : "text-amber-700 dark:text-amber-400 font-medium break-words"
            : "font-medium break-words"
        }
      >
        {right || "—"}
      </span>
    </div>
  );
};

type Props = {
  shop: RegisterShop | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Bestaand voorstel (leeg bij handmatig koppelen) */
  proposal?: { linkId: string; memberId: number; reden: string | null; score: number | null } | null;
  /** Vooraf gekozen lid (bij koppelen vanuit een ledenlocatie) */
  presetMemberId?: number | null;
  /** Vestigingssleutel van dat lid (bij koppelen vanuit een ledenlocatie) */
  presetLocationKey?: string | null;
};

const ConfirmLinkDialog = ({ shop, open, onOpenChange, proposal, presetMemberId, presetLocationKey }: Props) => {

  const { rawMembers, rawLeads } = useMembersData();
  const setLink = useSetRegisterLink();
  const [query, setQuery] = useState("");
  const [manualId, setManualId] = useState<number | null>(null);


  const alle: Member[] = useMemo(
    () => [...(rawMembers ?? []), ...(rawLeads ?? [])],
    [rawMembers, rawLeads],
  );

  const selectedId = proposal?.memberId ?? manualId ?? presetMemberId ?? null;
  const member = useMemo(
    () => alle.find((m) => m.id === selectedId) ?? null,
    [alle, selectedId],
  );

  const kandidaten = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as Member[];
    return alle
      .filter((m) =>
        [m.naam, m.plaats, m.bedrijfsnaam, ...(m.locaties ?? []).map((l) => l.naam)]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [alle, query]);

  const shopAdres = shop
    ? [shop.straat, [shop.huisnummer, shop.huisnummer_toevoeging].filter(Boolean).join("")]
        .filter(Boolean)
        .join(" ")
    : "";

  // Beste matchende locatie van het lid t.o.v. de shop
  const locatie = useMemo(() => {
    if (!member || !shop) return null;
    const locs = member.locaties ?? [];
    return (
      locs.find(
        (l) => norm(l.postcode) && norm(l.postcode) === norm(shop.postcode),
      ) ??
      locs.find((l) => norm(l.naam) === norm(shop.naam)) ??
      locs.find((l) => norm(l.plaats) === norm(shop.plaats)) ??
      locs[0] ??
      null
    );
  }, [member, shop]);

  const close = () => {
    setQuery("");
    setManualId(null);
    onOpenChange(false);
  };

  if (!shop) return null;

  const score = proposal?.score != null ? Math.round(proposal.score * 100) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{proposal ? "Voorstel controleren" : "Koppel aan lid"}</DialogTitle>
          <DialogDescription>
            {proposal ? (
              <>
                Reden: {proposal.reden ?? "onbekend"}
                {score != null && (
                  <>
                    {" · "}
                    <span className={score < 70 ? "text-amber-700 dark:text-amber-400 font-medium" : ""}>
                      zekerheid {score}%
                    </span>
                  </>
                )}
              </>
            ) : (
              "Zoek het juiste lid en vergelijk de gegevens voordat je koppelt."
            )}
          </DialogDescription>
        </DialogHeader>

        {!proposal && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Zoek lid op naam, locatie of plaats"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setManualId(null);
                }}
              />
            </div>
            {kandidaten.length > 0 && !manualId && (
              <div className="rounded-md border divide-y max-h-56 overflow-y-auto">
                {kandidaten.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50"
                    onClick={() => {
                      setManualId(m.id);
                      setQuery(m.naam);
                    }}
                  >
                    <span className="font-medium">{m.naam}</span>{" "}
                    <span className="text-muted-foreground">
                      · #{m.id} · {m.plaats || "—"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg border p-3">
          <div className="grid grid-cols-[7rem_1fr_1fr] gap-2 pb-2 text-xs uppercase tracking-wide text-muted-foreground border-b">
            <span />
            <span>Register</span>
            <span>{member ? `Lid #${member.id}` : "Lid"}</span>
          </div>
          <Row label="Naam" left={shop.naam} right={locatie?.naam ?? member?.naam} />
          <Row label="Adres" left={shopAdres} right={locatie?.adres} />
          <Row label="Postcode" left={shop.postcode} right={locatie?.postcode} />
          <Row label="Plaats" left={shop.plaats} right={locatie?.plaats ?? member?.plaats} />
          <Row
            label="Gemeente"
            left={shop.gemeente}
            right={undefined}
            compare={false}
          />
          <Row
            label="Vergunning"
            left={shop.vergunninghouder ?? shop.exploitant}
            right={member?.bedrijfsnaam}
            compare={false}
          />
          <Row label="KvK" left={undefined} right={locatie?.kvk ?? member?.kvk} compare={false} />
          {member && (member.locaties ?? []).length > 1 && (
            <p className="pt-2 text-xs text-muted-foreground">
              Dit lid heeft {member.locaties.length} locaties:{" "}
              {member.locaties.map((l) => `${l.naam}${l.plaats ? ` (${l.plaats})` : ""}`).join(", ")}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {proposal ? (
            <Button
              variant="ghost"
              className="text-destructive"
              disabled={setLink.isPending}
              onClick={() => {
                setLink.mutate(
                  {
                    register_id: shop.id,
                    member_id: proposal.memberId,
                    status: "afgewezen",
                    existingId: proposal.linkId,
                  },
                  { onSuccess: close },
                );
              }}
            >
              <X className="mr-1 h-4 w-4" /> Afwijzen
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={close}>
              Annuleren
            </Button>
            <Button
              disabled={!selectedId || setLink.isPending}
              onClick={() => {
                if (!selectedId) return;
                setLink.mutate(
                  {
                    register_id: shop.id,
                    member_id: selectedId,
                    status: "bevestigd",
                    existingId: proposal?.linkId,
                    previousStatus: proposal ? "voorstel" : undefined,
                    location_key: selectedId === presetMemberId ? presetLocationKey ?? null : null,
                  },
                  { onSuccess: close },
                );

              }}
            >
              <Check className="mr-1 h-4 w-4" /> Koppeling bevestigen
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmLinkDialog;
