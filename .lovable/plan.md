# Bestuursleden standaard aangemeld bij bestuursvergaderingen

## Wat er verandert

Bij elke bestuursvergadering staan alle bestuursleden voortaan automatisch als deelnemer in de lijst — niemand hoeft zich handmatig aan te melden. Afmelden blijft mogelijk: een bestuurslid of de beheerder kan de aanmelding verwijderen, en die afmelding komt niet terug.

Ook meteen meegenomen: bij een bestuursaanmelding wordt de naam van het bestuurslid automatisch als deelnemersnaam ingevuld, zodat er niet meer "Geen namen ingevuld" staat.

## Werking

- Aanvullen gebeurt automatisch op het moment dat een bestuursvergadering wordt aangemaakt of gegenereerd (de maandelijkse reeks), en voor bestaande toekomstige vergaderingen eenmalig bijgewerkt.
- Alleen vergaderingen van het type "bestuursvergadering" krijgen deze standaard-aanmeldingen; gewone evenementen niet.
- Verwijderde aanmeldingen worden niet opnieuw aangemaakt (afmelding blijft staan).
- Standaard 1 persoon per bestuurslid, met de naam van het bestuurslid ingevuld.
- Geen bevestigingsmail voor deze automatische aanmeldingen.

## Technisch

- Databasefunctie `public.seed_board_registrations(_event_id uuid)` (security definer): voegt voor elk actief bestuurslid uit `board_members` een rij toe in `agenda_registrations` met `board_member_id`, `guests = 1` en `attendee_names = [naam]`, alleen als er nog geen rij bestaat voor dat bestuurslid/event.
- Trigger op `agenda_events` (AFTER INSERT, WHERE `event_type = 'bestuursvergadering'`) die deze functie aanroept — werkt dus ook voor `generateMeetings`.
- Eenmalige backfill voor bestaande bestuursvergaderingen vanaf vandaag.
- `AgendaDeelnemersDialog.tsx`: bij het kiezen van een bestuurslid in "Nieuwe aanmelding" wordt het eerste naamveld voorgevuld met de naam van dat bestuurslid; bewerken/opslaan blijft ongewijzigd.
