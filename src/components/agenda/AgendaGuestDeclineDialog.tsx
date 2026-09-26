import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { formatEventDate, type AgendaEvent } from "@/hooks/useAgenda";
import type { AgendaGuestRegistration } from "@/hooks/useAgendaGuests";

interface Props {
  guest: AgendaGuestRegistration | null;
  event: AgendaEvent;
  onClose: () => void;
}

function defaultMessage(naam: string, event: AgendaEvent) {
  return `Beste ${naam},

Bedankt voor je aanmelding voor ${event.title} op ${formatEventDate(event.event_date)}. Helaas is deze bijeenkomst alleen toegankelijk voor aangesloten coffeeshopondernemers van de Bond. Je aanmelding is daarom niet doorgegaan.

Onze excuses voor het ongemak.

Met vriendelijke groet,
Bond van Cannabis Detaillisten`;
}

export default function AgendaGuestDeclineDialog({ guest, event, onClose }: Props) {
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (guest) setMessage(defaultMessage(guest.naam, event));
  }, [guest?.id]);

  const confirm = async () => {
    if (!guest || !message.trim()) return;
    setBusy(true);
    try {
      const { error: mailError } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "agenda-guest-declined",
          recipientEmail: guest.email,
          idempotencyKey: `agenda-guest-declined-${guest.id}`,
          templateData: { message: message.trim(), eventTitle: event.title },
        },
      });
      if (mailError) throw new Error("De mail kon niet worden verstuurd; de aanmelding is niet verwijderd.");
      const { error } = await supabase.from("agenda_guest_registrations").delete().eq("id", guest.id);
      if (error) throw new Error("Mail verstuurd, maar verwijderen is mislukt. Verwijder de aanmelding handmatig.");
      await qc.invalidateQueries({ queryKey: ["agenda-guests"] });
      toast.success(`Aanmelding verwijderd en mail verstuurd naar ${guest.email}`);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Weigeren mislukt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!guest} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Aanmelding weigeren</DialogTitle>
          <DialogDescription>
            {guest ? `${guest.naam}${guest.organisatie ? ` (${guest.organisatie})` : ""} — mail gaat naar ${guest.email}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="decline-msg">Mailtekst</Label>
          <Textarea
            id="decline-msg"
            rows={11}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Annuleren
          </Button>
          <Button onClick={confirm} disabled={busy || !message.trim()}>
            {busy ? "Bezig..." : "Verwijderen en mail versturen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
