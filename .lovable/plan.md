# Eigen afbeelding per evenement in de deel-preview

Nu toont de preview van `https://leden.coffeeshopbond.nl/a/CODE` altijd het standaard BCD-logo. Straks toont hij de afbeelding die bij het evenement zelf hoort, als die is toegevoegd.

## Wat je krijgt

- Heeft een agendapunt een afbeelding, dan verschijnt die in de WhatsApp-, LinkedIn- en Slack-preview én bovenaan de openbare uitnodigingspagina.
- Heeft een agendapunt geen afbeelding, dan blijft het BCD-logo de preview vullen — precies zoals nu.
- Bestaande evenementen met een afbeelding werken meteen mee; je hoeft niets opnieuw te uploaden.
- De afbeeldingen blijven verder afgeschermd: alleen de afbeelding van het gedeelde agendapunt is via de deel-link zichtbaar, de rest van de map niet.

## Aanpak

1. De openbare deel-opvraging geeft voortaan ook de afbeelding van het agendapunt terug (naast titel, datum, tijd en locatie).
2. Er komt één openbaar afbeeldingsadres per deelcode, bijvoorbeeld `https://leden.coffeeshopbond.nl/a/DTHLAU/afbeelding`. Dat adres levert alleen de afbeelding van dat ene agendapunt.
3. De uitnodigingspagina zet dat adres in zijn preview-gegevens en toont de afbeelding ook zichtbaar op de pagina.
4. Zonder afbeelding blijft het BCD-logo staan.

## Technisch

- Migratie: `get_agenda_share` uitbreiden met `image_path` (blijft `security definer`, geeft verder geen extra velden prijs).
- Nieuwe serverroute `src/routes/api/public/agenda-image.$code.ts`: zoekt via de deelcode het `image_path` op, haalt het bestand met de servicerol uit de private bucket `agenda-images` en streamt het terug met het juiste content-type en `Cache-Control: public, max-age=3600`. Onbekende code of geen afbeelding → 404.
- `src/lib/agendaShare.functions.ts`: `image_path` meenemen in `AgendaSharePreview`.
- `src/routes/a.$shareCode.tsx`: `og:image` en `twitter:image` naar het nieuwe adres wanneer er een afbeelding is, anders `/og-image.png`; de afbeelding ook boven de kaart tonen.
- `supabase/functions/agenda-share/index.ts` (fallback voor oude links) dezelfde `og:image` laten gebruiken.
- Let op afmeting: previews werken het best rond 1200x630; grote originelen worden door de route doorgegeven zoals ze zijn, dus wij adviseren bij het uploaden een liggende afbeelding.

## Let op

De preview op het live adres verandert pas na publiceren; daarna test ik de tags zoals WhatsApp ze ophaalt.
