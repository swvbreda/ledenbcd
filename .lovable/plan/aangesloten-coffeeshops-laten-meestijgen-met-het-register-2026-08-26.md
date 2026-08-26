# Aangesloten coffeeshops laten meestijgen met het register

## Vastgestelde oorzaak

- De dashboardkaart toont momenteel **159** op basis van locatierijen in het ledenbestand: **154 bij leden + 5 bij leads**.
- Er zijn **135 actieve, bevestigde registershops**, maar deze koppelingen worden niet meegenomen in deze dashboardtelling.
- Een bevestigde registerkoppeling voegt nu niet automatisch een ontbrekende locatie toe aan het ledenbestand. Er staan **111 open locatie-aanvullingsvoorstellen** klaar.
- De daling met één komt dus niet door een verdwenen registerkoppeling, maar doordat de huidige teller veranderde wanneer een locatierij in het ledenbestand werd opgeschoond of aangepast.

## Oplossing

1. Eén centrale berekening maken voor “vertegenwoordigde coffeeshops”: elke actieve, bevestigde registershop telt precies één keer, aangevuld met echte leden-/leadlocaties die nog niet aan het register gekoppeld zijn.
2. Deze centrale uitkomst gebruiken op het dashboard, Vertegenwoordiging, gemeentenoverzicht en de openbare statistiek, zodat alle schermen hetzelfde aantal tonen.
3. Koppelingen aan de juiste ledenvestiging laten meetellen via `location_key` en adres/postcode-matching; de vier bestaande bevestigde koppelingen zonder vestigingstoewijzing worden daarbij netjes afgehandeld.
4. De 111 open locatie-aanvullingsvoorstellen apart houden voor gegevensverrijking: een registershop mag al meetellen zodra de koppeling bevestigd is, zonder factuurgegevens of andere lidgegevens automatisch te overschrijven.
5. Controleoverzicht toevoegen voor afwijkingen: bevestigde registershop zonder vestiging, ledenlocatie zonder registershop en meerdere links naar dezelfde vestiging.
6. Na implementatie alle totalen opnieuw vergelijken en controleren dat dashboard, gemeentepagina en register exact dezelfde definitie gebruiken.

## Technisch

- Een beveiligde databasefunctie levert het totaal en de aantallen per gemeente op basis van de unieke combinatie van bevestigde actieve registershops en nog niet gekoppelde echte ledenlocaties.
- De frontend gebruikt deze functie via één gedeelde hook; de losse telling in `public-stats` en `countLocations` vervalt voor vertegenwoordiging.
- De bestaande fetch-and-merge-regels blijven gelden. Registerverrijking overschrijft geen factuurvelden.
