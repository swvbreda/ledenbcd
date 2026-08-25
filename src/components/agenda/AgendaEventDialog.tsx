import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  useAgendaMutations,
  type AgendaEvent,
  type AgendaEventType,
} from "@/hooks/useAgenda";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: AgendaEvent | null;
}

const emptyForm = {
  title: "",
  description: "",
  event_type: "evenement" as AgendaEventType,
  event_date: "",
  start_time: "",
  end_time: "",
  location: "",
  max_seats: "",
  is_published: true,
};

export default function AgendaEventDialog({ open, onOpenChange, event }: Props) {
  const { saveEvent } = useAgendaMutations();
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) return;
    setForm(
      event
        ? {
            title: event.title,
            description: event.description ?? "",
            event_type: event.event_type,
            event_date: event.event_date,
            start_time: event.start_time?.slice(0, 5) ?? "",
            end_time: event.end_time?.slice(0, 5) ?? "",
            location: event.location ?? "",
            max_seats: event.max_seats != null ? String(event.max_seats) : "",
            is_published: event.is_published,
          }
        : emptyForm,
    );
  }, [open, event]);

  const submit = () => {
    if (!form.title.trim() || !form.event_date) {
      toast.error("Titel en datum zijn verplicht");
      return;
    }
    saveEvent.mutate(
      {
        id: event?.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        event_type: form.event_type,
        event_date: form.event_date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        location: form.location.trim() || null,
        max_seats: form.max_seats ? Number(form.max_seats) : null,
        is_published: form.is_published,
      },
      {
        onSuccess: () => {
          toast.success(event ? "Agenda-item bijgewerkt" : "Agenda-item toegevoegd");
          onOpenChange(false);
        },
        onError: (e: any) => toast.error(e?.message || "Opslaan mislukt"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? "Agenda-item bewerken" : "Nieuw agenda-item"}</DialogTitle>
          <DialogDescription>
            Vergaderingen en evenementen verschijnen in de agenda van alle leden.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="ag-title">Titel</Label>
            <Input
              id="ag-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Bijv. Ledenbijeenkomst najaar"
            />
          </div>

          <div>
            <Label>Type</Label>
            <Select
              value={form.event_type}
              onValueChange={(v) => setForm({ ...form, event_type: v as AgendaEventType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="evenement">Evenement (leden kunnen zich aanmelden)</SelectItem>
                <SelectItem value="bestuursvergadering">Bestuursvergadering</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="ag-date">Datum</Label>
              <Input
                id="ag-date"
                type="date"
                value={form.event_date}
                onChange={(e) => setForm({ ...form, event_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ag-start">Van</Label>
              <Input
                id="ag-start"
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="ag-end">Tot</Label>
              <Input
                id="ag-end"
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="ag-loc">Locatie</Label>
              <Input
                id="ag-loc"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Bijv. Utrecht"
              />
            </div>
            <div>
              <Label htmlFor="ag-seats">Max. plaatsen</Label>
              <Input
                id="ag-seats"
                type="number"
                min={1}
                value={form.max_seats}
                onChange={(e) => setForm({ ...form, max_seats: e.target.value })}
                placeholder="Onbeperkt"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ag-desc">Omschrijving</Label>
            <Textarea
              id="ag-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="ag-pub"
              checked={form.is_published}
              onCheckedChange={(v) => setForm({ ...form, is_published: v })}
            />
            <Label htmlFor="ag-pub">Zichtbaar voor leden</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={submit} disabled={saveEvent.isPending}>
            Opslaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
