# Evenement aankondigen per e-mail

Als je een agenda-item van het type **Evenement** aanmaakt (niet bij bestuursvergaderingen), krijg je na opslaan een bevestigingsvenster om de aankondiging naar leden en leads te sturen.

## Wat je krijgt

**Na opslaan van een nieuw, gepubliceerd evenement**
- Venster "Evenement aankondigen" met: titel, datum, tijd, locatie en het aantal ontvangers (unieke e-mailadressen).
- Keuze van de doelgroep, standaard **Leden + leads** (alle bekende contactadressen van actieve leden en leads).
- Vrij tekstveld met een vooringevulde begeleidende tekst die je kunt aanpassen.
- Knoppen **Versturen** en **Niet nu**. Niets wordt verstuurd zonder klik op Versturen.
- Voortgangsbalk tijdens verzenden en een korte samenvatting achteraf (verzonden / mislukt / geblokkeerd).

**Niet van toepassing**
- Bestuursvergaderingen: geen venster, geen mail.
- Evenement bewerken of een niet-gepubliceerd (verborgen) evenement: geen venster.
- Later alsnog mailen kan via een knop **Aankondiging versturen** op de evenementkaart (alleen zichtbaar voor bestuur), zodat je het niet mist als je "Niet nu" kiest.

**Inhoud van de mail**
- Onderwerp: "Uitnodiging: {titel}".
- Datum, tijd, locatie, omschrijving en jouw begeleidende tekst.
- Knop "Bekijk en meld je aan" die naar de deelbare korte link van het evenement gaat (`/a/<code>`), zodat de ontvanger na inloggen direct bij het evenement uitkomt.
- BCD-huisstijl: witte achtergrond, rood accent, Archivo Black-achtige koppen.

## Technisch

- Nieuw template `supabase/functions/_shared/transactional-email-templates/agenda-event-announcement.tsx`, geregistreerd in `registry.ts`. Props: `eventTitle`, `eventDate`, `eventTime`, `location`, `description`, `intro`, `eventUrl`, `recipientName`.
- Nieuwe component `src/components/agenda/AgendaAnnounceDialog.tsx`: bouwt de ontvangerslijst (hergebruikt de adresverzameling uit `BulkEmailSend.tsx`, inclusief contactpersonen, ontdubbeling en e-mailvalidatie), toont aantallen en verstuurt per ontvanger via `send-transactional-email` met idempotency key `agenda-announce-{event_id}-{email}`.
- Doelgroepfilter op `member_type`: `member` en `lead`; onderdrukte adressen (`suppressed_emails`) worden overgeslagen door de bestaande verzendfunctie.
- `AgendaEventDialog.tsx`: `saveEvent`-mutatie geeft het opgeslagen item terug; bij een nieuw item met `event_type === "evenement"` en `is_published` opent het aankondigingsvenster.
- `useAgenda.ts`: `saveEvent` krijgt `.select().single()` zodat id en `share_code` beschikbaar zijn voor de link.
- Knop **Aankondiging versturen** in `AgendaEventCard.tsx` achter `isAdmin`, opent hetzelfde venster.
- Geen databasewijzigingen; verzendlogboek loopt via de bestaande `email_send_log`.
