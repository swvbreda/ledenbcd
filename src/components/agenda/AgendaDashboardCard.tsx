import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  useAgendaEvents,
  useAgendaRegistrations,
  useAgendaImageUrl,
  formatEventDate,
  formatTimeRange,
  isUpcoming,
  type AgendaEvent,
} from "@/hooks/useAgenda";

function AgendaPoster({ event }: { event: AgendaEvent }) {
  const { data: url } = useAgendaImageUrl(event.image_path);
  if (!url) return null;
  return (
    <div className="w-full shrink-0 overflow-hidden bg-muted/40 md:w-48">
      <img
        src={url}
        alt={`Poster van ${event.title}`}
        loading="lazy"
        className="aspect-[3/4] w-full object-contain transition-transform duration-700 group-hover:scale-105"
      />
    </div>
  );
}

function MetaItem({
  icon: Icon,
  children,
  highlight,
  boxed,
}: {
  icon: typeof Clock;
  children: React.ReactNode;
  highlight?: boolean;
  boxed?: boolean;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", boxed && "gap-3")}>
      {boxed ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-brand-red">
          <Icon className="h-4 w-4" />
        </span>
      ) : (
        <Icon className="h-3.5 w-3.5 shrink-0 text-brand-red" />
      )}
      <span className={cn("truncate", highlight && "font-semibold text-brand-red")}>{children}</span>
    </span>
  );
}

function MeetingRow({ event, guests }: { event: AgendaEvent; guests: number }) {
  return (
    <Link
      to="/agenda"
      className="group flex flex-col gap-4 rounded-2xl border border-transparent bg-muted/40 p-5 transition-all duration-300 hover:border-border hover:bg-muted/70 md:flex-row md:items-center md:justify-between"
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-base font-bold text-foreground">{event.title}</h3>
          <span className="rounded-lg bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Vergadering
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground">
          <span className="text-foreground/80">{formatEventDate(event.event_date)}</span>
          {formatTimeRange(event.start_time, event.end_time) && (
            <MetaItem icon={Clock}>{formatTimeRange(event.start_time, event.end_time)}</MetaItem>
          )}
          {event.location && <MetaItem icon={MapPin}>{event.location}</MetaItem>}
          <MetaItem icon={Users}>{guests} aangemeld</MetaItem>
        </div>
      </div>
      <span className="shrink-0 rounded-xl border border-border bg-background px-5 py-2 text-sm font-bold text-foreground transition-colors group-hover:bg-muted">
        Details
      </span>
    </Link>
  );
}

function EventHighlight({ event, guests }: { event: AgendaEvent; guests: number }) {
  return (
    <Link
      to="/agenda"
      className="group relative block overflow-hidden rounded-3xl border-2 border-primary bg-card shadow-xl shadow-primary/10 ring-4 ring-primary/5 transition-shadow hover:shadow-2xl hover:shadow-primary/20"
    >
      <div className="flex flex-col md:flex-row">
        <AgendaPoster event={event} />

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-xl leading-tight text-foreground md:text-2xl">
              {event.title}
            </h3>
            <span className="rounded-full bg-primary px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-foreground shadow-lg shadow-primary/20">
              Evenement
            </span>
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-3 text-sm font-semibold text-muted-foreground md:grid-cols-2">
            <MetaItem icon={CalendarDays} boxed highlight>
              {formatEventDate(event.event_date)}
            </MetaItem>
            {formatTimeRange(event.start_time, event.end_time) && (
              <MetaItem icon={Clock} boxed>
                {formatTimeRange(event.start_time, event.end_time)}
              </MetaItem>
            )}
            {event.location && (
              <MetaItem icon={MapPin} boxed>
                {event.location}
              </MetaItem>
            )}
            <MetaItem icon={Users} boxed>
              {guests} aangemeld
            </MetaItem>
          </div>
        </div>

        <div className="flex items-center justify-center border-border bg-muted/30 p-6 md:border-l">
          <span className="w-full rounded-xl bg-primary px-6 py-3 text-center text-sm font-bold uppercase tracking-wider text-primary-foreground shadow-lg shadow-primary/25 transition-transform group-hover:scale-105 md:w-auto">
            Aanmelden
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function AgendaDashboardCard() {
  const { data: events = [], isLoading } = useAgendaEvents();
  const { data: registrations = [] } = useAgendaRegistrations();
  const next = events.filter(isUpcoming).slice(0, 3);

  const guestsFor = (eventId: string) =>
    registrations.filter((r) => r.event_id === eventId).reduce((s, r) => s + r.guests, 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <CalendarDays className="h-5 w-5" />
          </span>
          <h2 className="font-display text-2xl tracking-tight text-foreground">Agenda</h2>
        </div>
        <Link
          to="/agenda"
          className="group flex items-center gap-2 text-sm font-bold text-primary hover:underline"
        >
          Alles bekijken
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
      <CardContent className="flex flex-col gap-4 px-4 pb-6 md:px-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden…</p>
        ) : next.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen geplande bijeenkomsten.</p>
        ) : (
          next.map((e) =>
            e.event_type === "evenement" ? (
              <EventHighlight key={e.id} event={e} guests={guestsFor(e.id)} />
            ) : (
              <MeetingRow key={e.id} event={e} guests={guestsFor(e.id)} />
            ),
          )
        )}
      </CardContent>
    </Card>
  );
}
