# Eén waarheid voor het aantal vertegenwoordigde coffeeshops

## Waarom 161 en 159 verschillen

Beide kaarten tellen dezelfde locaties, maar met een andere filter:

- Het dashboard toont **161**. Dat getal komt van de publieke statistiekfunctie, die simpelweg alle locatierijen telt: 156 bij leden + 5 bij leads.
- De pagina Gemeenten toont **159**. Die telt in de browser, en gooit daar eerst locatierijen weg die geen adres én geen plaats hebben: 154 + 5.

Het verschil van 2 zit bij lid #21 Hunters: dat lid heeft drie locatierijen "Hunters", waarvan er twee helemaal leeg zijn (geen adres, geen plaats). Dat zijn dubbele placeholderregels, geen echte coffeeshops.

## Wat er verandert

- **De lege locatierijen bij Hunters worden verwijderd** uit het ledenbestand, zodat er geen spookcoffeeshops meer meetellen.
- **De publieke statistiekfunctie gaat dezelfde opschoning toepassen** als de app: een locatie telt alleen mee als er een adres of een plaats bij staat. Daarmee geven dashboard, Gemeenten, Vertegenwoordiging en de openbare site altijd hetzelfde getal.
- **Alle kaarten gaan door één berekening**: er komt één gedeelde telfunctie die overal gebruikt wordt, zodat er niet opnieuw twee varianten kunnen ontstaan.
- Na de opschoning staat de teller op **159** (154 leden-locaties + 5 leads) op alle plekken.

## Technisch

- Nieuwe helper `src/lib/locationCount.ts` met `isRealLocation(loc)` en `countLocations(members)` (locatierij telt mee bij een gevuld `adres` of `plaats`; leden zonder locaties tellen als hun `aantalLocaties`, minimaal 1). `cleanLocaties` in `src/hooks/useMemberEdits.ts` gaat dezelfde predicaat gebruiken.
- `src/components/StatCards.tsx` (regels 48 en 73-81) en `src/pages/LocatiesPage.tsx` (regel 65) en `src/pages/MarktaandeelPage.tsx` gaan `countLocations` gebruiken in plaats van eigen reduces.
- `supabase/functions/public-stats/index.ts`: de telling in de loop filtert locaties op `adres || plaats` voordat ze meetellen; opnieuw deployen.
- Data-opschoning via run_sql: de twee lege `locaties`-elementen bij `members_data.id = 21` verwijderen en `aantalLocaties` bijwerken.
