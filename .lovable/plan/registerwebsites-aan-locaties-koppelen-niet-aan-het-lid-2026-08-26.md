# Registerwebsites aan locaties koppelen, niet aan het lid

De verrijkingsvoorstellen tonen nu vestigingslinks (bijv. `.../coffeeshops/the-bulldog-port`) onder "Algemene ledengegevens". Dat is onjuist: die URL's horen bij één specifieke coffeeshop/locatie.

Vastgesteld in de data: er staan 7 openstaande voorstellen met veld `website` en scope `lid` zonder `location_key` (o.a. The Bulldog 2x, Greenhouse 2x, The Plug West). Ze komen uit een aparte tak in de verrijkingsfunctie die de vestigingswebsite als lidwebsite voorstelt zodra het lid nog geen algemene website heeft.

## Wijzigingen

**Verrijkingsfunctie (`enrich-members-from-register`)**
- De tak die bij meerdere vestigingen een `scope: "lid"` website-voorstel maakt vervalt volledig.
- Websites uit het register gaan altijd naar de betreffende locatie: leeg locatieveld wordt direct gevuld, een afwijkende waarde wordt een voorstel met `scope: "locatie"` en de juiste `location_key` (dat pad bestaat al).
- Een lidbrede website wordt alleen nog overgenomen als het lid precies één vestiging heeft.

**Bestaande voorstellen opschonen**
- De 7 openstaande `website`-voorstellen met scope `lid` worden omgezet naar scope `locatie` met de `location_key` van de bijbehorende registershop, zodat ze in het paneel onder de juiste coffeeshop verschijnen. Voorstellen waarvoor geen locatie te bepalen is, worden verwijderd zodat er geen misleidende "algemene" voorstellen blijven staan.

Resultaat: in het goedkeuringspaneel staan websitevoorstellen onder de locatiekaart met adres- en registercontext, en het blok "Algemene ledengegevens" bevat alleen nog echt lidbrede velden.
