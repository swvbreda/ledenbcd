# Overige inkomsten terughalen + hernoemen

## Wat je ziet
De post **Overige inkomsten** staat op € 0,00, terwijl er vier nabetalingen over 2025 zijn vastgelegd (totaal € 6.500):

- 033 Horeca BV — € 3.000 (20-01-2026, factuur 202531024)
- Galerie Katsu B.V. — € 1.000 (08-04-2026, factuur 2025118)
- A.R. van der Ende — € 1.500 (08-04-2026, restant 2025)
- Happy Feelings B.V. — € 1.000 (21-04-2026, factuur 2025110)

## Oorzaak
De budgetgegevens halen handmatige boekingen alleen op als ze als *uitgaande* boeking zijn opgeslagen. Deze vier zijn (terecht) als *inkomende* boekingen vastgelegd en vallen daardoor volledig uit het overzicht. Ze staan er dus nog wel, maar worden niet meegeteld of getoond.

## Wat ik ga doen
1. **Naam wijzigen**: "Overige inkomsten" wordt **"Donaties en overige baten"**.
2. **Inkomende boekingen weer meetellen**: handmatige boekingen worden voortaan in beide richtingen opgehaald, zodat de vier nabetalingen weer zichtbaar zijn en optellen tot € 6.500 bij Ontvangen.
3. **Effect op uitgaven blijft correct**: bij kostenposten telt een inkomende boeking als correctie (min). Er is één zo'n boeking: € 3.000 bij Representatiekosten. Die verlaagt straks de getoonde uitgaven van die post met € 3.000, wat de bedoeling van zo'n creditboeking is. Zeg het als je die liever ongemoeid laat.

## Technisch
- `src/hooks/useBudget.ts`: het filter `direction = 'out'` bij het ophalen van `budget_expenses` vervalt; ontdubbeling tegen bankregels houdt al rekening met de richting.
- Naamwijziging van de begrotingsregel via een data-update op `budget_line_items` (post-id `b0d4b348…`, jaar 2026) en dezelfde post voor 2025.
- Geen schemawijzigingen; berekeningen in `BudgetCategoryTable`/`BudgetVsActualTable` blijven ongewijzigd.
