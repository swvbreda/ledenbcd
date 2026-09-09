# Outlook-koppeling bij aanmeldingen voor evenementen

Zodra een lid zich aanmeldt voor een **evenement** (niet voor bestuursvergaderingen), wordt hij toegevoegd aan de Outlook-afspraak van het secretariaat én krijgt hij een bevestigingsmail met agendabijlage. Meldt hij zich af, dan wordt hij weer uit de afspraak gehaald.

## Wat je krijgt

- **Outlook-afspraak per evenement.** Maak je een evenement aan (of publiceer je het), dan zetten we het als afspraak in de agenda van het secretariaat: titel, datum, begin- en eindtijd en locatie. Wijzig je het evenement later, dan werkt de afspraak mee.
- **Aanmelden = deelnemer toevoegen.** Wie zich aanmeldt, wordt als genodigde aan die afspraak toegevoegd en krijgt de Outlook-uitnodiging. We gebruiken het e-mailadres van het account/de contactpersoon; is dat er niet, dan slaan we het toevoegen over en zie je dat terug in de deelnemerslijst.
- **Bevestigingsmail met agendabijlage.** De aanmelder krijgt daarnaast onze eigen bevestigingsmail met een agenda-bestand dat in elke agenda-app (Apple, Google, Outlook) te openen is.
- **Afmelden = weer verwijderen.** De deelnemer wordt uit de Outlook-afspraak gehaald en krijgt de annulering van Outlook.
- **Annuleren van een evenement** verwijdert ook de Outlook-afspraak, zodat het bij iedereen uit de agenda verdwijnt.
- **Zichtbaarheid voor beheer:** in de deelnemerslijst staat per persoon of hij in de Outlook-afspraak staat, plus een knop "Outlook bijwerken" om alles opnieuw te synchroniseren als er iets misging.

Bestuursvergaderingen blijven ongewijzigd: die komen uit Topical en worden hier niet aangeraakt.

## Technisch

Database:
- `agenda_events`: velden `outlook_event_id text`, `outlook_synced_at timestamptz`, `outlook_error text` (naast het bestaande `external_event_id` van Topical, dat gereserveerd blijft voor bestuursvergaderingen).
- `agenda_registrations`: `outlook_attendee_email text`, `outlook_state text` ('pending' | 'invited' | 'removed' | 'error'), `outlook_error text`.

Backend (nieuwe edge function `sync-agenda-outlook`, gemodelleerd op `sync-topical-calendar`, zelfde `MS_GRAPH_*` client-credentials flow, mailbox `simone@coffeeshopbond.nl`):
- `action=upsert_event`: `POST/PATCH /users/{mailbox}/events` — maakt of werkt de afspraak bij; slaat `outlook_event_id` op.
- `action=sync_attendees`: leest alle actieve aanmeldingen van het evenement, bepaalt per lid het e-mailadres (accountmail via `member_registered_emails`, anders contactpersoon), en zet de volledige `attendees`-lijst in één PATCH op het event.
- `action=delete_event`: `DELETE /users/{mailbox}/events/{id}` bij annulering/verwijdering.
- Alleen `event_type = 'evenement'`. Autorisatie via service-role/`INTERNAL_WEBHOOK_SECRET`, zoals de bestaande functies. Runs loggen in `outlook_sync_log`.
- Aanroepen via een security-definer RPC `trigger_agenda_outlook_sync(_event_id uuid, _action text)` met `pg_net`, plus triggers op `agenda_events` (insert/update/cancel) en `agenda_registrations` (insert/delete) die de sync in de achtergrond starten. Fouten blokkeren de aanmelding nooit; ze landen in `outlook_error`.

E-mail:
- Bestaande template `agenda-registration-confirmation.tsx` uitbreiden met een `.ics`-bijlage (VEVENT met titel, start/eind in Europe/Amsterdam, locatie, `UID` = event-id, `METHOD:REQUEST`), gegenereerd in `send-transactional-email`.

Frontend:
- `useAgenda.ts`: nieuwe velden in de types; mutatie `syncOutlook` voor de handmatige knop.
- `AgendaDeelnemersDialog.tsx`: kolom/badge met Outlook-status per deelnemer + knop "Outlook bijwerken" (admin).

Randvoorwaarde: de Azure app-registratie heeft naast `Calendars.Read` ook **`Calendars.ReadWrite`** (application permission, met admin consent) nodig. Ontbreekt die, dan geeft de sync een duidelijke melding in het statusveld en blijft de rest van de agenda gewoon werken.
