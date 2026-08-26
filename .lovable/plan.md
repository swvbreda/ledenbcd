# Duidelijk maken op welke locatie een aanvulling slaat

## Probleem

De 138 openstaande aanvullingen zijn bijna allemaal locatie-specifiek (scope `locatie`, met een `location_key` zoals `1058AA`), maar het paneel toont alleen de ledennaam en het veld. Bij een lid met meerdere shops zie je dus niet welke vestiging je wijzigt — en een postcodewijziging van `1058 AC` naar `1058 AA` is dan blind accepteren.

## Wat er verandert

1. **Groeperen per locatie.** Binnen elk lid worden voorstellen gegroepeerd per vestiging, met een kopregel: shopnaam + huidig adres + plaats (uit de ledendata, aangevuld met de gekoppelde registervestiging). Voorstellen die het hele lid betreffen (scope niet-locatie) krijgen een aparte kop "Algemene ledengegevens".
2. **Herkomst tonen.** Per locatiegroep de gekoppelde registershop (naam, adres, plaats, vergunninghouder) waar het voorstel vandaan komt, zodat de vergelijking zichtbaar is: "dit staat bij ons" tegenover "dit staat in het register".
3. **Duidelijke waarschuwing bij niet-herkende locatie.** Als de `location_key` bij het lid geen locatie matcht (dezelfde matchregel als bij toepassen), wordt de rij gemarkeerd en accepteren geblokkeerd in plaats van pas bij het klikken te falen.
4. **Bevestiging bij accepteren.** Klikken op het vinkje toont een korte bevestiging: veld, locatie, oud → nieuw. Bij velden die facturatie raken blijft de bestaande rode waarschuwing staan.
5. **Alles-per-locatie accepteren.** Eén knop per locatiegroep om alle voorstellen van die vestiging in één keer over te nemen (of te negeren), zodat 138 losse klikken niet nodig zijn.
6. **Mobiele opmaak.** De rij wordt een compacte kaart (label boven, oud → nieuw eronder, knoppen rechts) zodat tekst niet meer door elkaar loopt op telefoon.

## Technisch

- Alleen frontend: `src/components/register/RegisterEnrichmentPanel.tsx` (groepering, locatiekop, bevestigingsdialoog, bulkknoppen) plus een kleine leeshook om de gekoppelde registervestigingen (`coffeeshop_register` op `register_id`) en de ledenlocaties op te halen voor de context.
- De matchlogica voor `location_key` uit `useResolveProposal` wordt naar een gedeelde helper getild zodat UI en toepassen dezelfde locatie aanwijzen.
- Geen databasewijzigingen; de bestaande voorstellen blijven ongewijzigd.
