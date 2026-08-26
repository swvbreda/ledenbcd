# Gemeente-detailpagina register

Een doorklikpagina per gemeente die laat zien welke coffeeshops uit het landelijke register onder die gemeente vallen, welke daarvan aan een lid gekoppeld zijn, en welke dossiers we bewust buiten de telling houden.

## Wat je krijgt

Nieuwe pagina `/coffeeshopregister/gemeente/:gemeente`, alleen zichtbaar voor bestuur/admin (zelfde afscherming als het Coffeeshopregister).

Bovenaan vier tellers voor die gemeente:
- Actieve registershops (de noemer waarmee vertegenwoordiging wordt berekend)
- Gekoppeld aan een lid (bevestigde koppelingen)
- Vertegenwoordigd (bevestigde koppelingen + ledenlocaties zonder registerkoppeling)
- Dekkingspercentage

Daaronder drie lijsten:

1. **Registershops in deze gemeente** — naam, adres, vergunninghouder, status, en per rij een badge: gekoppeld aan lid (met naam, doorklikbaar), openstaand voorstel, of niet gekoppeld.
2. **Ledenlocaties zonder registerkoppeling** — locaties uit het ledenbestand die in deze gemeente liggen maar niet aan een registerrij hangen. Deze tellen wel mee in de vertegenwoordiging, dus zichtbaar maken voorkomt verwarring over de aantallen.
3. **Uitgesloten dossiers** — alles wat uit de telling is gehaald, met de reden erbij:
   - Ruis (systeem- of kandidaat-dossier), inclusief de opgeslagen ruisreden
   - Vervallen
   - Gesloten (status of sluitingsdatum)

De ruisregels tonen de tekst die het register zelf meegeeft, bijvoorbeeld "Kandidaat-dossier zonder herkenbare shopnaam". Vandaag zijn dat 35 dossiers landelijk tegenover 566 actieve.

## Waar je erop klikt

- Coffeeshopregister: de gemeenteregels in het dekkingsoverzicht worden klikbaar.
- Vertegenwoordiging (Marktaandeel): per gemeente een link "Register bekijken".
- Locaties → gemeentedetail: knop "Register bekijken" bovenaan.

De bestaande gemeentepagina onder Locaties blijft ongewijzigd; die gaat over het ledenbestand, de nieuwe pagina over het register.

## Technisch

- Nieuwe pagina `src/pages/RegisterGemeenteDetailPage.tsx`, route toegevoegd in `src/App.tsx` binnen het beschermde blok, met dezelfde bestuur/admin-check als `CoffeeshopRegisterPage`.
- `RegisterShop` in `src/hooks/useCoffeeshopRegister.ts` uitgebreid met `raw` zodat `is_ruis`, `ruis_reden` en `gesloten_op` beschikbaar zijn; er wordt al `select("*")` gedaan, dus geen extra query.
- Gedeelde helper `src/lib/registerExclusion.ts` met `isActiveShop(shop)` en `exclusionReason(shop)`, met exact dezelfde criteria als de SQL-functies `get_register_plaats_stats` en `get_representation_stats` (niet vervallen, geen ruis, status niet gesloten, geen sluitingsdatum), zodat de pagina nooit uit de pas loopt met de dashboardtellers.
- Gemeentetoewijzing via `getGemeente` / `normalize_gemeente`-logica die al in `src/data/gemeenteMapping.ts` staat, zodat Zaandam onder Zaanstad valt enzovoort.
- Koppelingen en ledenlocaties uit `useRegisterLinks`, `useMembersData` + `useMergedMembers` en `src/lib/registerLocationMatch.ts` (bestaande matchlogica op postcode/huisnummer en naam).
- Geen databasewijzigingen nodig.
