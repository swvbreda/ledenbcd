# Zoeken op stad toont niet dezelfde locaties als de gemeentepagina

## Wat er misgaat (geverifieerd in de data)

Twee lijsten gebruiken verschillende bronnen:

- De **gemeentepagina** (`/locaties/Hilversum`) past eerst de goedgekeurde wijzigingen (`member_edits`) toe en filtert dan op locaties.
- Het **zoekveld in Ledenbestand** filtert op de *onbewerkte* basisgegevens en past de wijzigingen pas daarna toe.

Concreet in Hilversum:

- **Hunters (#21)** heeft de locatie "Hunters, Hilversum" alleen in de bewerkte gegevens. De gemeentepagina ziet hem, het zoekveld niet.
- **Piramide (#97)** heeft in de basisgegevens nog `plaats: Hilversum`, terwijl de bewerking `Bussum` zegt (en de locatie staat in Bussum). Daardoor komt Piramide wél in de zoekresultaten voor "hilversum", maar niet op de gemeentepagina.

Daarnaast staat er in `GemeenteDetailPage` een berekening die alleen op de gemeentenaam reageert en niet op de ledengegevens; daardoor kan de lijst bij binnenkomst leeg of verouderd blijven tot je iets aanpast.

Ook opgemerkt: Hunters heeft drie locatieregels met de naam "Hunters" waarvan twee helemaal leeg zijn (geen plaats/adres). Die tellen wel mee in "Locaties".

## Wat ik ga doen

1. **Zoeken en filteren op samengevoegde gegevens.** Het ledenoverzicht gaat zoeken/filteren op de gegevens inclusief goedgekeurde wijzigingen, zodat zoeken op een stad exact dezelfde leden en locaties oplevert als de gemeentepagina.
2. **Zoeken op stad verbeteren.** Naast plaatsnaam ook op gemeente matchen (via de bestaande gemeente-koppeling), zodat "Hilversum" ook shops vindt die onder de gemeente Hilversum vallen.
3. **Gemeentepagina live houden.** De berekening laten meebewegen met de ledengegevens, zodat de lijst direct klopt na laden of na een wijziging.
4. **Lege locatieregels negeren** in tellingen en lijsten (regels zonder naam/adres/plaats), zodat het aantal locaties klopt.

## Technisch

- `src/hooks/useMembers.ts`: `useMergedMembers` toepassen op de basislijst vóór filteren/zoeken; zoekterm ook tegen `getGemeente(plaats)` matchen.
- `src/pages/LedenPage.tsx`: dubbele merge verwijderen (lijsten komen dan al samengevoegd binnen).
- `src/pages/GemeenteDetailPage.tsx`: `mergedRepresented` toevoegen aan de `useMemo`-dependencies; lege locaties filteren.
- Geen databasewijzigingen; de afwijkende basisgegevens van Piramide worden overruled door de bestaande bewerking.
