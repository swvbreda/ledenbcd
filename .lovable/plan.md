# Mooie deel-link met echte preview

Doel: een gedeeld agenda-item ziet er in WhatsApp uit als
`https://leden.coffeeshopbond.nl/a/DTHLAU` mét een preview die titel, datum,
tijd en locatie toont.

## Waarom het nu niet werkt

- De preview-URL is het losse functie-adres (`.../functions/v1/agenda-share/DTHLAU`) — lang en technisch.
- Die functie levert wel correcte preview-tags, maar het antwoord komt binnen als platte tekst
  (`content-type: text/plain`) met een sandbox-header, dus WhatsApp leest de tags niet en toont geen preview.
- Op het eigen domein draait de app volledig in de browser: elke pagina levert dezelfde
  algemene HTML, dus daar kan per agenda-item nu geen eigen preview uit komen.

## Aanpak

### Stap 1 — Directe pleister (nu al zichtbaar)
De deelfunctie het antwoord als echte HTML laten uitleveren, zodat de preview in WhatsApp
meteen verschijnt. De zichtbare link blijft in deze stap nog het lange functie-adres.

### Stap 2 — Server-rendering aanzetten
De app upgraden naar Lovable's nieuwste template (TanStack Start). Daarmee wordt elke pagina
op `leden.coffeeshopbond.nl` op de server opgebouwd, inclusief eigen titel- en previewgegevens
per pagina. Deze migratie start je zelf: typ `/` in de chat en kies
"Migrate to TanStack Start". Daarna pak ik het vervolg op.

### Stap 3 — Agenda-deelpagina op eigen domein
Na de migratie:
- `/a/:code` wordt een server-gerenderde route die via de bestaande publieke deel-opvraging
  titel, datum, tijd en locatie ophaalt.
- Die route zet zijn eigen preview-tags (titel, omschrijving, afbeelding, canonical) zodat
  WhatsApp, LinkedIn en Slack het juiste kaartje tonen.
- De deelknop deelt voortaan `https://leden.coffeeshopbond.nl/a/CODE` — ook vanuit de telefoon-app.
- Het losse deel-endpoint blijft alleen als terugval voor eerder verstuurde links bestaan.

### Stap 4 — Controle
Testen met een echte code: preview-tags ophalen zoals WhatsApp dat doet, en de pagina in de
browser openen. Daarna publiceren, want previews komen pas na publicatie op het live adres.

## Technisch

- `supabase/functions/agenda-share/index.ts`: uitlevering forceren als `text/html`.
- Migratie naar TanStack Start (door jou gestart via `/`).
- Nieuwe route `src/routes/a.$code.tsx` met loader + `head` (alleen platte gegevens in de loader).
- `src/components/agenda/AgendaShareButton.tsx`: `buildShareUrl` wijst naar het portaaldomein.
- Bestaande RPC `get_agenda_share` en de deelcodes op `agenda_events` blijven ongewijzigd.

## Let op

De migratie raakt de hele app (routering, opbouw pagina's). Ik loop daarna de bestaande
pagina's na, maar reken op een testronde na de upgrade.
