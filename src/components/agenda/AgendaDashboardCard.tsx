import { Link } from "react-router-dom";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgendaEvents, useAgendaRegistrations, useAgendaImageUrl, formatEventDate, formatTimeRange, isUpcoming, type AgendaEvent } from "@/hooks/useAgenda";

function AgendaThumb({ event }: { event: AgendaEvent }) {
  const { data: url } = useAgendaImageUrl(event.image_path);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={`Afbeelding bij ${event.title}`}
      loading="lazy"
      className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
    />
  );
}

export default function AgendaDashboardCard() {
  const { data: events = [], isLoading } = useAgendaEvents();
  const { data: registrations = [] } = useAgendaRegistrations();
  const next = events.filter(isUpcoming).slice(0, 3);

  const guestsFor = (eventId: string) =>
    registrations.filter((r) => r.event_id === eventId).reduce((s, r) => s + r.guests, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4 text-brand-red" />
          Agenda
        </CardTitle>
        <Link to="/agenda" className="text-xs font-medium text-primary hover:underline">
          Alles bekijken
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden…</p>
        ) : next.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen geplande bijeenkomsten.</p>
        ) : (
          next.map((e) => (
            <Link
              key={e.id}
              to="/agenda"
              className="flex items-start gap-3 rounded-md border border-border p-3 transition-colors hover:bg-accent/40"
            >
              <AgendaThumb event={e} />
              <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{e.title}</span>
                <Badge variant={e.event_type === "evenement" ? "default" : "secondary"}>
                  {e.event_type === "evenement" ? "Evenement" : "Vergadering"}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{formatEventDate(e.event_date)}</span>
                {formatTimeRange(e.start_time, e.end_time) && (
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTimeRange(e.start_time, e.end_time)}
                  </span>
                )}
                {e.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {e.location}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {guestsFor(e.id)} aangemeld
                </span>
              </div>
              </div>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
