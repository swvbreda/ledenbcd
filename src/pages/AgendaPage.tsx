import { useMemo, useState } from "react";
import { CalendarPlus, Plus } from "lucide-react";
import { toast } from "sonner";
import BcdHeroBanner from "@/components/BcdHeroBanner";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import {
  useAgendaEvents,
  useAgendaRegistrations,
  useAgendaMutations,
  isUpcoming,
  type AgendaEvent,
} from "@/hooks/useAgenda";
import AgendaEventCard from "@/components/agenda/AgendaEventCard";
import AgendaEventDialog from "@/components/agenda/AgendaEventDialog";

const monthLabel = (date: string) =>
  new Date(date + "T00:00:00").toLocaleDateString("nl-NL", { month: "long", year: "numeric" });

export default function AgendaPage() {
  const { isAdmin, linkedMemberId } = useAuth();
  const { data: events = [], isLoading } = useAgendaEvents();
  const { data: registrations = [] } = useAgendaRegistrations();
  const { generateMeetings } = useAgendaMutations();
  const [newOpen, setNewOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const regsByEvent = useMemo(() => {
    const map = new Map<string, typeof registrations>();
    for (const r of registrations) {
      if (!map.has(r.event_id)) map.set(r.event_id, []);
      map.get(r.event_id)!.push(r);
    }
    return map;
  }, [registrations]);

  const upcoming = events.filter(isUpcoming);
  const past = events.filter((e) => !isUpcoming(e)).reverse();

  const grouped = useMemo(() => {
    const map = new Map<string, AgendaEvent[]>();
    for (const e of upcoming) {
      const key = monthLabel(e.event_date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return [...map.entries()];
  }, [upcoming]);

  const renderCard = (e: AgendaEvent) => (
    <AgendaEventCard
      key={e.id}
      event={e}
      registrations={regsByEvent.get(e.id) ?? []}
      isAdmin={isAdmin}
      memberId={linkedMemberId}
    />
  );

  return (
    <div className="space-y-6 overflow-x-hidden p-4 sm:p-6">
      <BcdHeroBanner title="Agenda" subtitle="Bestuursvergaderingen en evenementen" />

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Nieuw agenda-item
          </Button>
          <Button
            variant="outline"
            disabled={generateMeetings.isPending}
            onClick={() =>
              generateMeetings.mutate(new Date().getFullYear(), {
                onSuccess: () => toast.success("Bestuursvergaderingen gegenereerd"),
                onError: (err: any) => toast.error(err?.message || "Genereren mislukt"),
              })
            }
          >
            <CalendarPlus className="mr-1 h-4 w-4" />
            Vergaderingen {new Date().getFullYear()} genereren
          </Button>
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner message="Agenda laden..." />
      ) : (
        <>
          {grouped.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Er staan nog geen items in de agenda.
            </p>
          ) : (
            grouped.map(([month, items]) => (
              <section key={month} className="space-y-3">
                <h2 className="font-display text-sm uppercase text-muted-foreground">{month}</h2>
                {items.map(renderCard)}
              </section>
            ))
          )}

          {past.length > 0 && (
            <Collapsible open={archiveOpen} onOpenChange={setArchiveOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm">
                  {archiveOpen ? "Verberg" : "Toon"} afgelopen items ({past.length})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3 opacity-80">
                {past.map(renderCard)}
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}

      <AgendaEventDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}
