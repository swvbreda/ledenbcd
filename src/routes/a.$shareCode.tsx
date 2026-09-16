import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { savePostLoginPath } from "@/lib/postLoginPath";
import { getAgendaSharePreview, registerAgendaGuest } from "@/lib/agendaShare.functions";
import logo from "@/assets/bcd-logo.png";

const PORTAL = "https://leden.coffeeshopbond.nl";

const fmtDate = (d: string) => {
  try {
    return new Date(`${d}T12:00:00Z`).toLocaleDateString("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Amsterdam",
    });
  } catch {
    return d;
  }
};

const fmtTime = (t?: string | null) => (t ? t.slice(0, 5) : null);

const timeRange = (s?: string | null, e?: string | null) =>
  [fmtTime(s), fmtTime(e)].filter(Boolean).join(" - ");

export const Route = createFileRoute("/a/$shareCode")({
  loader: ({ params }) => getAgendaSharePreview({ data: { code: params.shareCode } }),
  head: ({ params, loaderData }) => {
    const code = params.shareCode.toUpperCase();
    const url = `${PORTAL}/a/${code}`;
    if (!loaderData) {
      return {
        meta: [
          { title: "Uitnodiging niet gevonden — BCD Ledenportaal" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const cancelled = !!loaderData.cancelled_at;
    const description = [
      cancelled ? "GEANNULEERD" : null,
      fmtDate(loaderData.event_date),
      timeRange(loaderData.start_time, loaderData.end_time) || null,
      loaderData.location || null,
    ]
      .filter(Boolean)
      .join(" · ");
    const title = `${cancelled ? "Geannuleerd: " : ""}${loaderData.title} — BCD Ledenportaal`;
    const image = loaderData.image_path
      ? `${PORTAL}/api/public/agenda-image/${code}`
      : `${PORTAL}/og-image.png`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex" },
        { property: "og:type", content: "article" },
        { property: "og:site_name", content: "BCD Ledenportaal" },
        { property: "og:title", content: `${cancelled ? "Geannuleerd: " : ""}${loaderData.title}` },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: `${cancelled ? "Geannuleerd: " : ""}${loaderData.title}` },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: AgendaSharePage,
});

function AgendaSharePage() {
  const event = Route.useLoaderData();
  const { shareCode } = Route.useParams();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  // Aanmelding voor niet-leden
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [organisatie, setOrganisatie] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [guests, setGuests] = useState("1");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [foutmelding, setFoutmelding] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFoutmelding(null);
    try {
      const res = await registerAgendaGuest({
        data: {
          code: shareCode,
          naam,
          email,
          organisatie,
          telefoon,
          guests: Number(guests) || 1,
          note,
        },
      });
      if (res.ok) setSent(res.message);
      else setFoutmelding(res.message);
    } catch {
      setFoutmelding("Aanmelden lukte niet. Probeer het later opnieuw.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session && event) {
        void navigate({ to: "/agenda/$eventId", params: { eventId: event.id }, replace: true });
        return;
      }
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, [event?.id]);

  const goLogin = () => {
    if (event) savePostLoginPath(`/agenda/${event.id}`);
    void navigate({ to: "/login" });
  };

  if (!event) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border-2 border-primary/40 bg-card p-6 text-center space-y-3">
          <h1 className="font-display uppercase text-xl text-primary">Uitnodiging niet gevonden</h1>
          <p className="text-sm text-muted-foreground">
            Deze uitnodiging is niet (meer) beschikbaar.
          </p>
          <Button onClick={() => void navigate({ to: "/login" })}>Naar het ledenportaal</Button>
        </div>
      </main>
    );
  }

  const time = timeRange(event.start_time, event.end_time);
  const cancelled = !!event.cancelled_at;

  return (
    <main className="min-h-screen bg-background flex items-start sm:items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border-2 border-primary/50 bg-card space-y-5 p-5 sm:p-7">
        {event.image_path && (
          <img
            src={`/api/public/agenda-image/${shareCode.toUpperCase()}`}
            alt={event.title}
            className="-mx-5 -mt-5 sm:-mx-7 sm:-mt-7 mb-1 w-[calc(100%+2.5rem)] sm:w-[calc(100%+3.5rem)] max-w-none object-cover aspect-[16/9]"
          />
        )}
        <div className="flex items-center gap-3">

          <img src={logo} alt="Bond van Cannabis Detaillisten" className="h-10 w-auto" />
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Uitnodiging · Bond van Cannabis Detaillisten
          </p>
        </div>

        <h1 className="font-display uppercase text-2xl sm:text-3xl text-primary leading-tight">
          {event.title}
        </h1>

        {cancelled && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm font-semibold text-destructive">
            Dit evenement is geannuleerd
            {event.cancel_reason ? `: ${event.cancel_reason}` : "."}
          </p>
        )}


        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-brand-red" />
            <span>{fmtDate(event.event_date)}</span>
          </li>
          {time && (
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand-red" />
              <span>{time}</span>
            </li>
          )}
          {event.location && (
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-brand-red" />
              <span>{event.location}</span>
            </li>
          )}
        </ul>

        <div className="space-y-2">
          <Button className="w-full" onClick={goLogin} disabled={checking}>
            {cancelled ? "Naar het ledenportaal" : "Inloggen en aanmelden"}
          </Button>
          {!cancelled && (
            <p className="text-xs text-muted-foreground">
              Ben je lid? Log in met je account van het ledenportaal — je komt direct bij deze
              uitnodiging uit.
            </p>
          )}
        </div>

        {!cancelled && (
          <div className="border-t pt-5">
            {sent ? (
              <p className="rounded-md border border-primary/40 bg-primary/5 px-3 py-3 text-sm">
                {sent}
              </p>
            ) : (
              <form className="space-y-3" onSubmit={onSubmit}>
                <div>
                  <h2 className="font-display uppercase text-base text-primary">
                    Geen lid? Meld je hier aan
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Laat je gegevens achter, dan zetten wij je op de deelnemerslijst.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    required
                    placeholder="Naam *"
                    value={naam}
                    onChange={(e) => setNaam(e.target.value)}
                  />
                  <Input
                    required
                    type="email"
                    placeholder="E-mailadres *"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Input
                    placeholder="Bedrijf / organisatie"
                    value={organisatie}
                    onChange={(e) => setOrganisatie(e.target.value)}
                  />
                  <Input
                    placeholder="Telefoonnummer"
                    value={telefoon}
                    onChange={(e) => setTelefoon(e.target.value)}
                  />
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    placeholder="Aantal personen"
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                  />
                </div>
                <Textarea
                  rows={2}
                  placeholder="Opmerking (optioneel)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                {foutmelding && (
                  <p className="text-sm text-destructive">{foutmelding}</p>
                )}
                <Button type="submit" variant="outline" className="w-full" disabled={busy}>
                  {busy ? "Bezig met aanmelden…" : "Aanmelden"}
                </Button>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
