# Budgettotalen netto per categorie

## Wat er nu misgaat

De kaart "Begroting vs Werkelijk" rekent per begrotingsregel in plaats van per categorie:

- Regels met ruimte over tellen op tot "beschikbaar" (alleen positieve bedragen).
- Regels boven budget tellen apart op tot "overschreden" (alleen negatieve bedragen).

Bij Donaties (begroot € 6.000, uitgegeven € 5.000) staat daardoor tegelijk € 3.000 beschikbaar en € 2.000 overschreden: één onderliggende post is € 2.000 over budget, een andere heeft nog € 3.000 ruimte. Rekenkundig kloppend, maar tegenstrijdig om te lezen.

## Wat ik ga aanpassen

1. **Categorierij**: Beschikbaar = Begroot − Uitgegeven (netto). Bij Donaties wordt dat € 1.000 over.
2. **Overschrijding** wordt alleen nog getoond als de héle categorie boven budget staat (dan is Beschikbaar negatief en rood).
3. **Kopregel van de kaart** (totaal beschikbaar / totaal overschreden): dezelfde netto-logica over alle uitgavencategorieën, zodat "beschikbaar" en "overschreden" elkaar niet meer tegenspreken.
4. **Detailniveau blijft ongewijzigd**: per begrotingsregel zie je nog steeds precies welke post over budget zit (rood negatief bedrag), zodat je overschrijdingen niet uit het oog verliest.

## Technisch

- `src/components/budget/BudgetVsActualTable.tsx`: `available`/`overrun` per categorie vervangen door `net = budgeted − spent`; `available = max(net, 0)`, `overrun = min(net, 0)`; totalen als som van die netto-waarden.
- `src/components/budget/BudgetCategoryTable.tsx`: subtotaalrij en kopregel gebruiken `totalRemaining` (netto) in plaats van de gesplitste `availableTotal` / `overrunTotal`; per-regel weergave blijft zoals die is.
- Geen wijzigingen in database of in de onderliggende uitgavenberekening (alleen betaalde boekingen tellen mee, ongewijzigd).
