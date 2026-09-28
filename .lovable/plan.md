# Echte pagina-afbeeldingen voor deel-previews

## Wat verandert
- Alle openbare schermen krijgen eigen, nauwkeurige titel, omschrijving, canonical, `og:url` en bijpassende Twitter-tags in de eerste HTML-respons.
- De inlog-, externe inlog- en andere openbare toegangsschermen krijgen veilige 1200×630 schermafbeeldingen van hun publieke beginscherm; er komen geen leden- of andere privégegevens in beeld.
- De openbare uitnodigingspagina behoudt haar bestaande, evenement-specifieke afbeelding. Zonder evenementafbeelding gebruikt zij een veilige schermafbeelding van de openbare uitnodigingspagina.
- Beveiligde schermen krijgen geen schermafbeelding van ingelogde inhoud en houden een veilige algemene inlog-preview.
- De zichtbare website blijft ongewijzigd.

## Uitvoering
1. Openbare routes en toegangsstatus definitief classificeren.
2. Veilige publieke beginschermen op 1200×630 vastleggen en als versievaste JPG/PNG-bestanden opslaan.
3. Metadata per openbare route toevoegen of corrigeren; dynamische routes krijgen passende, veilige terugvalmetadata.
4. Alleen werkelijk statische openbare routes vooraf als HTML opbouwen; dynamische uitnodigingen blijven via de bestaande serverweergave werken.
5. Productiebouw controleren en ruwe eerste HTML testen voor de hoofdpagina en twee openbare subpagina’s; alle afbeeldingsadressen op bestaan en afbeeldingsformaat controleren.

## Technisch
- TanStack Start `head()` blijft de enige metadata-oplossing; geen client-only Helmet.
- Canonicals en afbeeldingen gebruiken absolute adressen onder `https://leden.coffeeshopbond.nl`.
- Bestaande evenement-specifieke previewroute blijft leidend en wordt niet vervangen door een algemene afbeelding.
- Geen publicatie; alleen preview en bronwijzigingen voor beoordeling.
