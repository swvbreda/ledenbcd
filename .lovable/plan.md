# Afstand berekenen weer laten werken

## Wat er misgaat
Het formulier probeert de afstand wel vanzelf te berekenen. Maar de gratis adresdienst die de app gebruikt (OpenStreetMap), weigert de aanvragen. In de foutmeldingen staat steeds "Adresdienst is tijdelijk niet bereikbaar". Je ziet daardoor alleen een vage melding rechtsonder en geen kilometers.

## Oplossing
1. **Andere adresdienst:** voor het opzoeken van adressen gebruiken we voortaan de officiële adressenlijst van de Nederlandse overheid (PDOK). Die is gratis, heeft geen sleutel nodig en kent alle Nederlandse adressen goed. OpenStreetMap blijft als reserve als PDOK een keer niet werkt.
2. **Duidelijke melding:** lukt de berekening toch niet, dan zie je in gewone taal waarom. Bijvoorbeeld "Adres niet gevonden: …". Je kunt de kilometers dan zelf invullen in het veld "Km (totaal)".
3. Daarna test ik de berekening met jouw route, Amstelveen naar Breukelen.

## Technische details
- `supabase/functions/calculate-route/index.ts`: geocoderen via `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=…&rows=1&fq=type:(adres OR postcode OR weg OR woonplaats)`. Het veld `centroide_ll` heeft de vorm `POINT(lon lat)`. Als dat niets oplevert, valt de functie terug op Nominatim, één aanvraag na de andere in plaats van tegelijk. De route blijft via OSRM lopen.
- In `InternalDeclarationsView.tsx` leest de app bij een fout het JSON-veld `error` uit de response (`error.context`), zodat de echte melding in de toast verschijnt.
- Daarna de functie opnieuw uitrollen. De database verandert niet en er wordt niets gepubliceerd.
