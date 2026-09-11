# Agenda-uitnodiging wordt een bevestiging

Deelnemers hebben zich al aangemeld. Ze horen dus geen vraag "wil je komen?" te krijgen, maar een bevestiging die meteen in hun agenda staat.

## Wat er verandert

- Geen Accepteren/Weigeren-knoppen meer in het Outlook-bericht. Het is een bevestiging, geen verzoek.
- De afspraak wordt direct als bevestigd in de agenda van de deelnemer gezet, zonder dat die iets hoeft te doen.
- Onderwerp en tekst worden een bevestiging: "Bevestiging aanmelding — <naam evenement>", met datum, tijd en locatie.
- Bij annulering blijft de bestaande annuleringsmelding werken; die haalt de afspraak weg uit hun agenda.

## Voor wie

- Nieuwe aanmeldingen: automatisch, direct na aanmelden.
- De vijf komende evenementen die vandaag al zijn verstuurd: eenmalig opnieuw versturen als bevestiging, zodat iedereen dezelfde nette versie in de agenda krijgt.

## Technisch

1. `src/routes/api/public/agenda-outlook-sync.ts`
   - `responseRequested: false` in de Graph-payload (geen RSVP-vraag, uitnodigingsmail wordt nog steeds verzonden).
   - Onderwerp naar "Bevestiging aanmelding — <titel>"; body begint met een bevestigende zin.
   - Verificatie-GET blijft, maar controleert nu `isDraft` en aantal deelnemers.
2. `src/hooks/useAgenda.ts` — bevestigingsmail-ICS: `PARTSTAT=ACCEPTED`, `RSVP=FALSE` bij de attendee, methode blijft `REQUEST` zodat het item in de agenda belandt zonder actie. `CANCEL` blijft ongewijzigd.
3. `src/routes/api/public/agenda-outlook-backfill.ts` — zelfde payload-wijziging; de "al beantwoord"-controle vervalt en wordt een expliciete lijst `event_ids` of alle komende evenementen, zodat de eenmalige herverzending gecontroleerd draait.
4. Uitvoeren: eerst `dry_run`, daarna de echte run voor de vijf komende evenementen; resultaat loggen in `outlook_sync_log`.
