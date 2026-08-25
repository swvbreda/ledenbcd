# Beschikbaar budget anders berekenen

## Wat er nu gebeurt

Per regel is Beschikbaar simpelweg Begroot − Uitgaven. Het subtotaal is de optelsom daarvan, dus een overschrijding op de ene post wordt weggestreept tegen ruimte op een andere. In Algemene kosten leidt dat tot € 264,04 "beschikbaar", terwijl vier posten samen € 12.506,28 over hun budget zijn en Vergaderkosten nog € 10.207,67 ruimte heeft. Dat totaal geeft dus een te rooskleurig beeld.

Daarnaast tellen in Uitgaven ook boekingen mee die nog niet betaald zijn (handmatige/Informer-regels met status onbetaald). Bankmutaties zijn altijd betaald.

## Wat we veranderen

### 1. Overschrijdingen niet meer wegstrepen

Per categorie en in het jaartotaal tonen we drie waarden in plaats van één:

- **Beschikbaar** — de som van alleen de posten die nog ruimte hebben (Algemene kosten: € 12.770,32)
- **Overschreden** — de som van alleen de posten die over budget zijn, in rood (Algemene kosten: € 12.506,28)
- **Saldo** — het oude getal (verschil van die twee), kleiner en grijs erachter, zodat de aansluiting met Begroot − Uitgaven zichtbaar blijft

Per regel blijft de weergave zoals hij is: ruimte in zwart, overschrijding in rood.

### 2. Alleen betaalde uitgaven tellen mee

Uitgaven telt voortaan alleen boekingen die daadwerkelijk betaald zijn (alle bankmutaties, plus handmatige/Informer-regels met betaalstatus betaald). Nog niet betaalde boekingen verdwijnen niet: die komen als aparte, grijze regel "Nog te betalen" onder het subtotaal, zodat je ziet wat er nog aankomt.

### 3. Zelfde logica op het dashboard

De balk "Begroting vs Werkelijk" gebruikt nu ook Begroot − Uitgegeven als resterend. Die krijgt dezelfde splitsing (beschikbaar / overschreden) en dezelfde betaald-filter, zodat dashboard en begrotingstabel niet langer verschillende bedragen laten zien.

## Buiten scope

Welke betaling op welke post staat, verandert niet. Er zijn wel opvallende boekingen (bijv. € 8.607,20 Van Ham Holding op Administratiekosten, € 2.382,49 Notulen Software op Kantoorkosten, declaraties S. van Breda op Vergaderkosten) — zeg het als je die alsnog wilt herindelen; dat doen we dan apart.

## Technisch

- `src/components/budget/BudgetCategoryTable.tsx`: subtotaal-/kopregel-berekening splitsen in `availableTotal` (som van `max(rest, 0)`) en `overrunTotal` (som van `min(rest, 0)`); saldo behouden als secundaire waarde. Inkomstencategorieën houden hun huidige "Nog te ontvangen"-logica.
- Uitgaven-som (`sumExpenses`) filtert op `e.paid !== false`; het onbetaalde deel apart optellen voor de "Nog te betalen"-regel. Ponto-regels hebben al `paid: true` in `useBudget.ts`, dus daar verandert niets.
- `src/components/budget/BudgetVsActualTable.tsx`: dezelfde filter en splitsing in de kopregel en de resterend-kolom.
- Geen database- of schemawijziging.
