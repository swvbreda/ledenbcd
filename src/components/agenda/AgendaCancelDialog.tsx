import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  formatTimeRange,
  type AgendaEvent,
} from "@/hooks/useAgenda";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: AgendaEvent;
  /** Aantal aangemelde personen (voor de melding in het venster). */
  attendeeCount: number;
}

export default function AgendaCancelDialog({ open, onOpenChange, event, attendeeCount }: Props) {
  const { cancelEvent } = useAgendaMutations();
  const [reason, setReason] = useState("Te weinig aanmeldingen");
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    if (open) {
      setReason("Te weinig aanmeldingen");
      setNotify(true);
    }
  }, [open]);

  const submit = () => {
    cancelEvent.mutate(
      { id: event.id, reason, notify },
      {
        onSuccess: ({ emailed }) => {
          toast.success(
            emailed > 0
              ? `Evenement geannuleerd — ${emailed} bericht(en) verstuurd`
              : "Evenement geannuleerd",
          );
          onOpenChange(false);
        },
        onError: (e: any) => toast.error(e?.message || "Annuleren mislukt"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Evenement annuleren</DialogTitle>
          <DialogDescription>
            "{event.title}" op {formatEventDate(event.event_date)}
            {formatTimeRange(event.start_time, event.end_time)
              ? `, ${formatTimeRange(event.start_time, event.end_time)}`
              : ""}
            . Het item blijft zichtbaar in de agenda, maar aanmelden is niet meer mogelijk.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="cancel-reason">Reden (zichtbaar voor leden)</Label>
            <Textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Bijv. te weinig aanmeldingen"
            />
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="cancel-notify"
              checked={notify}
              onCheckedChange={(v) => setNotify(v === true)}
            />
            <Label htmlFor="cancel-notify" className="text-sm font-normal leading-snug">
              Aangemelde deelnemers per e-mail informeren
              <span className="block text-xs text-muted-foreground">
                {attendeeCount > 0
                  ? `${attendeeCount} personen zijn aangemeld.`
                  : "Er zijn nog geen aanmeldingen."}
              </span>
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Niet annuleren
          </Button>
          <Button
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={submit}
            disabled={cancelEvent.isPending}
          >
            {cancelEvent.isPending ? "Bezig…" : "Evenement annuleren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
