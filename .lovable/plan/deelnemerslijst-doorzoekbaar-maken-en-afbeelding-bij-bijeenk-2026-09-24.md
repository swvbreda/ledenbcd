# Deelnemerslijst doorzoekbaar maken en afbeelding bij bijeenkomst herstellen

## 1. Mississippi staat er wel, maar is lastig te vinden
Coffeeshop Mississippi staat aangemeld voor de Experiment bijeenkomst (op 11 september, contactpersoon Stephan Korsten). De lijst "Huidige deelnemers" heeft 17 aanmeldingen en staat op volgorde van aanmelddatum. Mississippi staat daardoor halverwege, als 12e.

Wat er verandert:
- De deelnemers komen op alfabetische volgorde te staan: eerst het bestuur, dan de leden.
- Boven de lijst komt een zoekveld (naam, plaats of contactpersoon).
- Bij elk lid staat de plaats erbij, zodat je shops sneller herkent.

## 2. De afbeelding wordt niet bewaard
Jouw afbeelding is vandaag twee keer goed geüpload (19:51 en 20:06). Toch is hij niet aan de Experiment bijeenkomst gekoppeld: bij die bijeenkomst staat geen afbeelding. De kaart kan hem dus ook niet tonen. Aan de opmaak van vorige keer ligt het niet.

Wat ik doe:
1. Het bewerken met een afbeelding in de preview nadoen, ingelogd als jouw account, om te zien waar de koppeling verloren gaat. Mogelijke oorzaken: het opslaan mislukt stil na het uploaden, of een oudere versie van het formulier overschrijft de afbeelding daarna weer.
2. De oorzaak herstellen, zodat een geüploade afbeelding altijd bij de bijeenkomst blijft staan. Mislukt het opslaan toch, dan krijg je een duidelijke melding.
3. Je laatst geüploade afbeelding (20:06) aan de Experiment bijeenkomst koppelen, zodat je hem niet opnieuw hoeft te uploaden.
4. Controleren dat de afbeelding op de kaart en op de deelpagina verschijnt.

## Let op
De automatische koppeling van bijeenkomsten naar Outlook staat in de database weer aan, terwijl die eerder was uitgezet. Er gaat niets naar Outlook, want de pauzeschakelaar staat nog steeds uit. Ik verander hier niets aan zonder jouw akkoord.

## Technisch
- `AgendaDeelnemersDialog.tsx`: registraties sorteren op `rowLabel` (bestuur eerst, dan `localeCompare` op "nl"), zoekfilter op label, plaats, contact_name en attendee_names, plaats tonen via de ledenmap.
- Afbeelding: `AgendaEventDialog.tsx`, `saveEvent` in `useAgenda.ts` en de agenda-outlook-sync-route, die `agenda_events` bijwerkt, nagaan op het wegschrijven van `image_path`. Reproduceren met Playwright en een ingelogde sessie; de update-respons controleren.
- Koppelen via run_sql: `image_path = '148822bc-53e3-49bc-8457-6c50b808d9ee.png'` voor event `861ea485-…`.
- `trg_agenda_events_outlook` staat op enabled (O). Ik meld dit alleen en laat het ongewijzigd.
