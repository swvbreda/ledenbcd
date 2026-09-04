import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { useSaveMemberEdit } from "@/hooks/useMemberEdits";
import { useMembersData } from "@/contexts/MembersDataContext";
import { formatPhone, normalizePhone } from "@/lib/phoneMatch";
import {
  buildMemberContactPatch,
  isPhoneKnown,
  type SaveContactMode,
} from "@/lib/memberContactUpsert";
import { memberLabel } from "@/lib/communityMatch";
import type { Member } from "@/data/types";

export interface PendingContactLink {
  memberId: number;
  naam: string;
  telefoon: string | null;
  email?: string | null;
}

const schema = z.object({
  naam: z.string().trim().min(1, "Naam is verplicht").max(100, "Naam is te lang"),
  functie: z.string().trim().max(60).optional(),
  telefoon: z.string().trim().max(30).optional(),
  email: z.string().trim().max(255).email("Ongeldig e-mailadres").optional().or(z.literal("")),
});

interface Props {
  pending: PendingContactLink | null;
  /** Wordt aangeroepen zodra de gebruiker een keuze heeft gemaakt (ook bij "niets opslaan"). */
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/** Vraagt bij het koppelen wat er bij het lid moet worden opgeslagen. */
const SaveContactToMemberDialog = ({ pending, onConfirm, onCancel }: Props) => {
  const { rawMembers, rawLeads } = useMembersData();
  const saveEdit = useSaveMemberEdit();

  const member: Member | undefined = useMemo(
    () => [...rawMembers, ...rawLeads].find((m) => m.id === pending?.memberId),
    [rawMembers, rawLeads, pending?.memberId],
  );

  const [mode, setMode] = useState<SaveContactMode>("contact");
  const [naam, setNaam] = useState("");
  const [functie, setFunctie] = useState("Community");
  const [telefoon, setTelefoon] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pending) return;
    setMode("contact");
    setNaam(pending.naam?.trim() || "");
    setFunctie("Community");
    setTelefoon(pending.telefoon?.trim() || "");
    setEmail(pending.email?.trim() || "");
  }, [pending]);

  const phoneKnown = !!(member && telefoon && isPhoneKnown(member, telefoon));
  const primaryDiffers =
    !!member && (!member.telefoon?.trim() || normalizePhone(member.telefoon) !== normalizePhone(telefoon));

  const submit = async () => {
    if (!pending || !member) return;
    if (mode !== "none") {
      const parsed = schema.safeParse({ naam, functie, telefoon, email });
      if (!parsed.success) {
        toast({
          title: "Controleer de gegevens",
          description: parsed.error.issues[0]?.message,
          variant: "destructive",
        });
        return;
      }
    }

    setBusy(true);
    try {
      const patch = mode === "none" ? null : buildMemberContactPatch(member, { naam, functie, telefoon, email }, mode);
      if (patch) {
        await saveEdit.mutateAsync({ member_id: member.id, data: patch });
        toast({ title: "Opgeslagen bij het lid", description: memberLabel(member) });
      }
      await onConfirm();
    } catch (e) {
      toast({
        title: "Opslaan mislukt",
        description: e instanceof Error ? e.message : "Onbekende fout",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!pending} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Gegevens opslaan bij het lid?</DialogTitle>
          <DialogDescription>
            {member ? memberLabel(member) : "Lid"} · {naam || "—"} ·{" "}
            <span className="font-mono">{formatPhone(telefoon) || telefoon || "geen nummer"}</span>
          </DialogDescription>
        </DialogHeader>

        {phoneKnown && (
          <p className="text-xs text-muted-foreground">
            Dit telefoonnummer is al bekend bij dit lid — er wordt niets dubbel opgeslagen.
          </p>
        )}

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as SaveContactMode)} className="gap-2">
          <label className="flex items-start gap-2 rounded-md border border-border p-2.5 cursor-pointer">
            <RadioGroupItem value="contact" className="mt-0.5" />
            <span className="text-sm">
              <span className="font-medium">Toevoegen als contactpersoon</span>
              <span className="block text-xs text-muted-foreground">
                Naam en telefoonnummer komen in de contactenlijst van het lid.
              </span>
            </span>
          </label>
          {primaryDiffers && (
            <label className="flex items-start gap-2 rounded-md border border-border p-2.5 cursor-pointer">
              <RadioGroupItem value="primary" className="mt-0.5" />
              <span className="text-sm">
                <span className="font-medium">Hoofdtelefoonnummer bijwerken</span>
                <span className="block text-xs text-muted-foreground">
                  Huidig hoofdnummer: {formatPhone(member?.telefoon) || "leeg"}
                  {member?.contactpersoon ? ` · ${member.contactpersoon}` : ""}
                </span>
              </span>
            </label>
          )}
          <label className="flex items-start gap-2 rounded-md border border-border p-2.5 cursor-pointer">
            <RadioGroupItem value="none" className="mt-0.5" />
            <span className="text-sm">
              <span className="font-medium">Niets opslaan</span>
              <span className="block text-xs text-muted-foreground">Alleen de koppeling vastleggen.</span>
            </span>
          </label>
        </RadioGroup>

        {mode !== "none" && (
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Naam</Label>
                <Input value={naam} onChange={(e) => setNaam(e.target.value)} maxLength={100} />
              </div>
              <div>
                <Label className="text-xs">Functie</Label>
                <Input
                  value={functie}
                  onChange={(e) => setFunctie(e.target.value)}
                  maxLength={60}
                  disabled={mode === "primary"}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Telefoon</Label>
                <Input value={telefoon} onChange={(e) => setTelefoon(e.target.value)} maxLength={30} />
              </div>
              <div>
                <Label className="text-xs">E-mail (optioneel)</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Annuleren
          </Button>
          <Button
            className="bg-brand-red hover:bg-brand-red/90 text-white"
            onClick={submit}
            disabled={busy}
          >
            {busy ? "Bezig…" : "Koppelen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SaveContactToMemberDialog;
