import { useState } from "react";
import { CalendarDays, Clock, MapPin, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  useAgendaMutations,
  useAgendaImageUrl,
  useAgendaBoardAttendance,
  formatEventDate,
  formatTimeRange,
  isUpcoming,
  type AgendaEvent,
  type AgendaRegistration,
} from "@/hooks/useAgenda";
import AgendaEventDialog from "./AgendaEventDialog";
import AgendaRegistrationDialog from "./AgendaRegistrationDialog";
import AgendaDeelnemersDialog from "./AgendaDeelnemersDialog";


interface Props {
  event: AgendaEvent;
  registrations: AgendaRegistration[];
  isAdmin: boolean;
  memberId: number | null;
}

export default function AgendaEventCard({ event, registrations, isAdmin, memberId }: Props) {
  const { unregister, deleteEvent } = useAgendaMutations();
  const { data: imageUrl } = useAgendaImageUrl(event.image_path);
  const [editOpen, setEditOpen] = useState(false);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [deelnemersOpen, setDeelnemersOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEvent = event.event_type === "evenement";
  const upcoming = isUpcoming(event);
  const own = memberId != null ? registrations.find((r) => r.member_id === memberId) : undefined;
  const totalGuests = registrations.reduce((s, r) => s + r.guests, 0);
  const seatsLeft = event.max_seats != null ? Math.max(event.max_seats - totalGuests, 0) : null;
  const full = seatsLeft != null && seatsLeft <= 0 && !own;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base uppercase">{event.title}</h3>
            <Badge variant={isEvent ? "default" : "secondary"}>
              {isEvent ? "Evenement" : "Bestuursvergadering"}
            </Badge>
            {!event.is_published && <Badge variant="outline">Concept</Badge>}
            {full && <Badge variant="destructive">Volgeboekt</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 text-brand-red" />
              {formatEventDate(event.event_date)}
            </span>
            {formatTimeRange(event.start_time, event.end_time) && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-brand-red" />
                {formatTimeRange(event.start_time, event.end_time)}
              </span>
            )}
            {event.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-brand-red" />
                {event.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-brand-red" />
              {totalGuests} aangemeld
              {event.max_seats != null ? ` / ${event.max_seats}` : ""}
            </span>
          </div>
          {imageUrl && (
            <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block">
              <img
                src={imageUrl}
                alt={`Afbeelding bij ${event.title}`}
                loading="lazy"
                className="max-h-72 w-auto rounded-md border border-border object-contain"
              />
            </a>
          )}
          {event.description && (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{event.description}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {upcoming && memberId != null && (
            own ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setRegisterOpen(true)}>
                  Wijzigen ({own.guests} pers.)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    unregister.mutate(own.id, {
                      onSuccess: () => toast.success("Je bent afgemeld"),
                      onError: (e: any) => toast.error(e?.message || "Afmelden mislukt"),
                    })
                  }
                >
                  Afmelden
                </Button>
              </>
            ) : (
              <Button size="sm" disabled={full} onClick={() => setRegisterOpen(true)}>
                {full ? "Volgeboekt" : "Aanmelden"}
              </Button>
            )
          )}
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setDeelnemersOpen(true)}>
                Deelnemers
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </div>

      <AgendaEventDialog open={editOpen} onOpenChange={setEditOpen} event={event} />

      {memberId != null && (
        <AgendaRegistrationDialog
          open={registerOpen}
          onOpenChange={setRegisterOpen}
          event={event}
          memberId={memberId}
          existing={own}
          seatsLeft={seatsLeft}
        />
      )}

      {isAdmin && (
        <AgendaDeelnemersDialog
          open={deelnemersOpen}
          onOpenChange={setDeelnemersOpen}
          event={event}
          registrations={registrations}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Agenda-item verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              "{event.title}" wordt verwijderd, inclusief alle aanmeldingen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteEvent.mutate(event.id, {
                  onSuccess: () => toast.success("Agenda-item verwijderd"),
                  onError: (e: any) => toast.error(e?.message || "Verwijderen mislukt"),
                })
              }
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
