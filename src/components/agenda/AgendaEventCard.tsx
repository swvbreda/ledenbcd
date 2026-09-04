import { useState } from "react";
import { CalendarDays, Clock, MapPin, Megaphone, Pencil, Trash2, Users, Video } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
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
import { useMembersData } from "@/contexts/MembersDataContext";
import AttendanceList from "./AttendanceList";
import AgendaEventDialog from "./AgendaEventDialog";
import AgendaRegistrationDialog from "./AgendaRegistrationDialog";
import AgendaDeelnemersDialog from "./AgendaDeelnemersDialog";
import AgendaShareButton from "./AgendaShareButton";
import AgendaAnnounceDialog from "./AgendaAnnounceDialog";


interface Props {
  event: AgendaEvent;
  registrations: AgendaRegistration[];
  isAdmin: boolean;
  memberId: number | null;
}

export default function AgendaEventCard({ event, registrations, isAdmin, memberId }: Props) {
  const { unregister, deleteEvent } = useAgendaMutations();
  const { isBoard } = useAuth();
  const { data: imageUrl } = useAgendaImageUrl(event.image_path);
  const { data: boardAttendance = [] } = useAgendaBoardAttendance();
  const { rawMembers, rawLeads } = useMembersData();
  const boardPresent = boardAttendance.filter((b) => b.event_id === event.id);
  const [editOpen, setEditOpen] = useState(false);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [deelnemersOpen, setDeelnemersOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);

  const isEvent = event.event_type === "evenement";
  const upcoming = isUpcoming(event);
  const own = memberId != null ? registrations.find((r) => r.member_id === memberId) : undefined;
  const totalGuests = registrations.reduce((s, r) => s + r.guests, 0);
  const seatsLeft = event.max_seats != null ? Math.max(event.max_seats - totalGuests, 0) : null;
  const full = seatsLeft != null && seatsLeft <= 0 && !own;

  // Namen van aangemelde deelnemers (leden/leads); bestuur staat al in de eigen regel.
  const memberNames = new Map<number, string>();
  for (const m of [...rawMembers, ...rawLeads]) {
    memberNames.set(m.id, m.naam || m.bedrijfsnaam || `Lid #${m.id}`);
  }
  const attendeeEntries = registrations
    .filter((r) => !r.board_member_id)
    .flatMap((r) => {
      const base = r.member_id != null ? memberNames.get(r.member_id) ?? `Lid #${r.member_id}` : "Onbekend";
      const names = (r.attendee_names ?? []).filter((n) => n.trim().length > 0);
      if (names.length === 0) return [{ name: base, detail: null as string | null }];
      return names.map((n) => ({ name: n, detail: base }));
    });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
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
          <AttendanceList
            label="Bestuur aanwezig"
            entries={boardPresent.map((b) => ({ name: b.naam, detail: b.functie }))}
          />
          <AttendanceList label="Aangemeld" entries={attendeeEntries} />

          {event.description && (
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed">{event.description}</p>
          )}
        </div>

        <div className="flex w-full shrink-0 flex-col items-stretch gap-3 md:w-64 md:items-end">
          {imageUrl && (
            <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block">
              <img
                src={imageUrl}
                alt={`Afbeelding bij ${event.title}`}
                loading="lazy"
                className="aspect-[3/4] w-full rounded-md border border-border bg-muted/40 object-contain"
              />

            </a>
          )}
          {upcoming &&
            (memberId != null && own ? (
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
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
              </div>
            ) : memberId != null ? (
              <Button className="w-full md:w-auto" disabled={full} onClick={() => setRegisterOpen(true)}>
                {full ? "Volgeboekt" : "Aanmelden"}
              </Button>
            ) : isAdmin ? (
              <Button className="w-full md:w-auto" disabled={full} onClick={() => setDeelnemersOpen(true)}>
                {full ? "Volgeboekt" : "Aanmelden"}
              </Button>
            ) : (
              <div className="space-y-1 md:text-right">
                <Button
                  className="w-full md:w-auto"
                  disabled={linking}
                  onClick={async () => {
                    setLinking(true);
                    try {
                      const { data, error } = await (supabase as any).rpc("ensure_member_link");
                      if (error) throw error;
                      if ((data ?? 0) > 0) {
                        toast.success("Je account is gekoppeld — je kunt je nu aanmelden");
                        window.location.reload();
                      } else {
                        toast.error(
                          "Je account is nog niet aan een lid gekoppeld — neem contact op met het secretariaat",
                        );
                      }
                    } catch (e: any) {
                      toast.error(e?.message || "Koppeling herstellen mislukt");
                    } finally {
                      setLinking(false);
                    }
                  }}
                >
                  {linking ? "Bezig..." : "Aanmelden"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Lukt aanmelden niet? Je account is dan nog niet aan een lid gekoppeld — neem
                  contact op met het secretariaat.
                </p>
              </div>
            ))}

          {upcoming && <AgendaShareButton event={event} className="w-full md:w-auto" />}

          {upcoming && event.meeting_url && (own || isAdmin || isBoard) && (
            <Button asChild variant="outline" className="w-full md:w-auto">
              <a href={event.meeting_url} target="_blank" rel="noopener noreferrer">
                <Video className="mr-1 h-4 w-4 text-brand-red" />
                Deelnemen aan Topical
              </a>
            </Button>
          )}
        </div>
      </div>

      {isAdmin && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <Button variant="outline" size="sm" onClick={() => setDeelnemersOpen(true)}>
            Deelnemers
          </Button>
          {isEvent && upcoming && (
            <Button variant="outline" size="sm" onClick={() => setAnnounceOpen(true)}>
              <Megaphone className="mr-1 h-4 w-4 text-brand-red" />
              Aankondiging versturen
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      )}


      <AgendaAnnounceDialog open={announceOpen} onOpenChange={setAnnounceOpen} event={event} />

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
