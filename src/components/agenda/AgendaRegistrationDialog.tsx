import { useEffect, useMemo, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import {
  useAgendaMutations,
  useMemberContactOptions,
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

const OTHER = "__anders__";

export default function AgendaRegistrationDialog({
  open,
  onOpenChange,
  event,
  memberId,
  existing,
  seatsLeft,
}: Props) {
  const { register } = useAgendaMutations();
  const { user } = useAuth();
  const { data: contacts = [] } = useMemberContactOptions(open ? memberId : null);
  const [guests, setGuests] = useState("1");
  const [note, setNote] = useState("");
  const [choice, setChoice] = useState<string>(OTHER);
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");

  const userEmail = (user?.email ?? "").toLowerCase();

  const defaultChoice = useMemo(() => {
    if (existing?.contact_email) {
      const hit = contacts.find((c) => c.email === existing.contact_email);
      if (hit) return hit.email;
      return OTHER;
    }
    const own = contacts.find((c) => c.email && c.email === userEmail);
    if (own) return own.email;
    const first = contacts.find((c) => c.email);
    return first ? first.email : OTHER;
  }, [contacts, existing?.contact_email, userEmail]);

  useEffect(() => {
    if (!open) return;
    setGuests(existing ? String(existing.guests) : "1");
    setNote(existing?.note ?? "");
    setChoice(defaultChoice);
    setCustomName(existing?.contact_name ?? "");
    setCustomEmail(
      existing?.contact_email && !contacts.some((c) => c.email === existing.contact_email)
        ? existing.contact_email
        : "",
    );
    // contacts komen asynchroon binnen; defaultChoice werkt dan bij.
  }, [open, existing?.id, defaultChoice]);

  const selected = contacts.find((c) => c.email === choice) ?? null;
  const contactName = selected ? selected.naam : customName.trim();
  const contactEmail = selected ? selected.email : customEmail.trim().toLowerCase();

  const submit = () => {
    const n = Number(guests);
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Vul een geldig aantal personen in");
      return;
    }
    if (!contactName) {
      toast.error("Vul de naam in van de persoon die komt");
      return;
    }
    if (!contactEmail) {
      toast.error("Geen e-mailadres bekend — vul er een in voor de bevestiging");
      return;
    }
    register.mutate(
      {
        id: existing?.id,
        event_id: event.id,
        member_id: memberId,
        guests: n,
        note: note.trim() || null,
        attendee_names: [contactName],
        contact_name: contactName,
        contact_email: contactEmail,
      },
      {
        onSuccess: (res) => {
          if (existing) toast.success("Aanmelding bijgewerkt");
          else if (res?.emailed)
            toast.success(`Je bent aangemeld — bevestiging verstuurd naar ${contactEmail}`);
          else toast.success("Je bent aangemeld (geen bevestigingsmail verstuurd)");
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
            <Label htmlFor="reg-contact">Wie komt er?</Label>
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger id="reg-contact">
                <SelectValue placeholder="Kies een contactpersoon" />
              </SelectTrigger>
              <SelectContent>
                {contacts
                  .filter((c) => c.email)
                  .map((c) => (
                    <SelectItem key={c.email} value={c.email}>
                      {c.naam} — {c.email}
                    </SelectItem>
                  ))}
                <SelectItem value={OTHER}>Iemand anders…</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              De bevestiging gaat alleen naar deze persoon.
            </p>
          </div>

          {!selected && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="reg-name">Naam</Label>
                <Input
                  id="reg-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Voor- en achternaam"
                />
              </div>
              <div>
                <Label htmlFor="reg-email">E-mailadres</Label>
                <Input
                  id="reg-email"
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="naam@voorbeeld.nl"
                />
              </div>
            </div>
          )}

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
