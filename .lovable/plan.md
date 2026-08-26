# Extra tekst uit budgettabellen halen

De cijfers blijven staan; alleen de kleine toelichtende regels eronder verdwijnen zodat de tabellen rustig ogen.

## Wat weg gaat

**Begroting vs Werkelijk (categorie-tabel)**
- Het rode woordje "overschreden" onder het bedrag in de kolom Beschikbaar. Een overschrijding blijft zichtbaar doordat het bedrag rood en negatief wordt getoond.
- De regel "· overschreden € …" in de samenvatting boven de tabel (het uitgegeven/beschikbaar-deel blijft).

**Budget per categorie (uitklapbare tabel)**
- De kleine hintregel onder de kolomkoppen (uitleg over klikken op bedragen).
- Het "(overschreden)" label achter het subtotaal in de kopregel; het rode bedrag blijft.

## Technisch

- `src/components/budget/BudgetVsActualTable.tsx`: regels 57-64 (samenvatting-overschreden) en 102-104 (label per rij) verwijderen, kolomcel vereenvoudigen tot alleen `CurrencyCell`.
- `src/components/budget/BudgetCategoryTable.tsx`: `clicks.remainingHint`-regel (regel 158) en het `(overschreden)`-span (regel 119) verwijderen; bijbehorende ongebruikte variabelen opruimen.

Geen wijzigingen aan berekeningen of data.
