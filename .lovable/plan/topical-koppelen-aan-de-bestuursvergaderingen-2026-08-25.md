# Topical koppelen aan de bestuursvergaderingen

Topical heeft geen open API — alleen koppelingen met Google Calendar, Outlook (Microsoft Calendar), Microsoft Todo en Zapier. Jouw Outlook-koppeling (simone@coffeeshopbond.nl) staat al op **Actief**. Die gebruiken we als brug: wat Topical in jouw Outlook-agenda zet, halen wij op en tonen we bij de bestuursvergaderingen.

## Wat je krijgt

- Elke bestuursvergadering in de agenda krijgt een **Topical-vergaderlink**, automatisch overgenomen uit de Outlook-afspraak die Topical aanmaakt.
- De knop **Deelnemen aan Topical** verschijnt op de agendakaart, maar **alleen voor wie is aangemeld** (bestuursleden staan standaard al aangemeld). Niet-aangemelde leden zien de link niet.
- Wijzigt Topical de datum, tijd of titel? Dan werkt de volgende synchronisatie het agenda-item bij.
- Admin kan de link ook handmatig invullen of overschrijven in het agenda-item (veld "Vergaderlink"), voor het geval een vergadering niet uit Topical komt.
- De uitnodiging blijft vanuit Topical komen — wij zetten de link niet in onze bevestigingsmail.

## Hoe de koppeling werkt

```text
Topical  ->  Outlook agenda (simone@coffeeshopbond.nl)  ->  automatische sync  ->  agenda_events
```

De sync draait automatisch (elk uur) en is ook met één knop handmatig te starten op de agendapagina.

Koppelen gebeurt op datum + tijd: een Outlook-afspraak wordt gekoppeld aan de bestuursvergadering op dezelfde dag; is er geen, dan wordt het item niet aangemaakt (we importeren geen privé-afspraken — alleen afspraken die Topical als organisator/bron heeft).

## Technisch

Database:
- `agenda_events` uitbreiden met `meeting_url text`, `external_source text` ('topical'), `external_event_id text` (Outlook event id) en `external_synced_at timestamptz`.
- RLS ongewijzigd; de link wordt in de frontend alleen getoond aan gebruikers met een eigen aanmelding voor dat event (of admins).

Backend:
- Nieuwe edge function `supabase/functions/sync-topical-calendar/index.ts`, gemodelleerd op de bestaande `sync-outlook-contacts` (zelfde `MS_GRAPH_TENANT_ID/CLIENT_ID/CLIENT_SECRET` client-credentials flow).
- Haalt via Graph `/users/{mailbox}/calendarView` de afspraken op voor de komende ~120 dagen; filtert op afspraken die van Topical komen (organisator/`onlineMeeting`/body bevat een `topical`-link).
- Leest de vergaderlink uit `onlineMeeting.joinUrl`, anders de eerste `topicalmeetings.com`-URL in `body`/`location`.
- Matcht op bestaand `agenda_events`-item met `event_type = 'bestuursvergadering'` en dezelfde `event_date`; werkt `meeting_url`, tijden en titel bij. Logt de run in `outlook_sync_log`.
- `pg_cron`-taak die de functie elk uur aanroept, plus een RPC/knop voor handmatig synchroniseren.

Frontend:
- `src/hooks/useAgenda.ts`: `meeting_url` toevoegen aan het `AgendaEvent`-type en aan `AgendaEventInput`; mutatie voor handmatige sync.
- `src/components/agenda/AgendaEventCard.tsx`: knop "Deelnemen aan Topical" (`<a target="_blank">`, geen `window.open`) zichtbaar als de gebruiker een aanmelding heeft voor dat event, of admin is.
- `src/components/agenda/AgendaEventDialog.tsx`: veld "Vergaderlink" voor admins.
- `src/pages/AgendaPage.tsx`: admin-knop "Topical synchroniseren".

Randvoorwaarde: de Azure app-registratie die nu contacten leest heeft ook **Calendars.Read** (application permission) nodig. Ontbreekt die, dan geeft de sync een duidelijke foutmelding en moet die rechtenuitbreiding eenmalig worden toegekend.

Alternatief als je liever niets in Azure aanpast: Topical → Zapier → webhook naar een edge function. Dat werkt ook, maar vraagt een Zapier-account en handmatige zap-configuratie.
