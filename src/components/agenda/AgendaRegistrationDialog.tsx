import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAgendaMutations,
  formatEventDate,
  type AgendaEvent,
  type AgendaRegistration,
} from "@/hooks/useAgenda";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: AgendaEvent;
  memberId: number;
  existing?: AgendaRegistration | null;
  seatsLeft: number | null;
}

export default function AgendaRegistrationDialog({
  open,
  onOpenChange,
  event,
  memberId,
  existing,
  seatsLeft,
}: Props) {
  const { register } = useAgendaMutations();
  const [guests, setGuests] = useState("1");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setGuests(existing ? String(existing.guests) : "1");
    setNote(existing?.note ?? "");
  }, [open, existing]);

  const submit = () => {
    const n = Number(guests);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Vul een geldig aantal personen in");
      return;
    }
    register.mutate(
      { id: existing?.id, event_id: event.id, member_id: memberId, guests: n, note: note.trim() || null },
      {
        onSuccess: (res) => {
          if (existing) toast.success("Aanmelding bijgewerkt");
          else if (res?.emailed) toast.success("Je bent aangemeld — bevestiging per e-mail verstuurd");
          else toast.success("Je bent aangemeld (geen e-mailadres bekend)");
          onOpenChange(false);
        },
        onError: (e: any) => toast.error(e?.message || "Aanmelden mislukt"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Aanmelding wijzigen" : "Aanmelden"}</DialogTitle>
          <DialogDescription>
            {event.title} — {formatEventDate(event.event_date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="reg-guests">Aantal personen</Label>
            <Input
              id="reg-guests"
              type="number"
              min={1}
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
            />
            {seatsLeft != null && (
              <p className="mt-1 text-xs text-muted-foreground">Nog {seatsLeft} plaatsen beschikbaar</p>
            )}
          </div>
          <div>
            <Label htmlFor="reg-note">Opmerking of dieetwens</Label>
            <Textarea
              id="reg-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optioneel"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={submit} disabled={register.isPending}>
            {existing ? "Opslaan" : "Aanmelden"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
