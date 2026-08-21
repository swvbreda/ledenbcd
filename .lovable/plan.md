# Dossieroverzicht opschonen

## Wat er misgaat
Bij het automatisch koppelen van bankbetalingen aan leden krijgt elke contributiebetaling een "dossier" met de naam van het lid en het factuurnummer (bijv. `Contributie #65 (2025107)`, `Contributie · Coffeeshop Relax (#8)`). Dat zijn geen werkdossiers, maar ze vullen nu wel het hele dossieroverzicht. Daarnaast bestaan "Groene tafel" en "Samenwerking PCN" naast elkaar terwijl het één dossier is; de regels erin zijn dezelfde kosten, één keer via de bank en één keer via Informer.

## Wat we doen

### 1. Contributie-dossiers verbergen
- Dossiers waarvan de naam met "Contributie" begint, worden niet meer als dossier getoond in het dossieroverzicht.
- De koppeling aan het lid en de factuur blijft ongewijzigd in de database en in de contributie-/ledenoverzichten.
- Ze verschijnen ook niet meer in de keuzelijst "bestaand dossier" bij het koppelen van mutaties.

### 2. Groene tafel + Samenwerking PCN samenvoegen
- Alle mutaties van "Groene tafel" worden verplaatst naar dossier **Samenwerking PCN**.
- Dubbele regels (dezelfde kosten via bank én via Informer, herkenbaar aan gelijk bedrag en nagenoeg gelijke datum/tegenpartij) worden in het dossier als één regel getoond, zodat het totaal niet dubbel telt. De onderliggende boekingen blijven bewaard; de dubbel is alleen samengevouwen met een indicatie dat er twee bronnen zijn.

## Technisch
- `src/lib/budgetExclusions.ts` (of een nieuw klein helperbestand) krijgt `isContributionDossier(name)`; `DossierOverzichtTab.tsx` filtert daarmee de dossierrijen en de selectlijst.
- Eenmalige data-update: `ponto_transactions`, `bank_transactions` en `budget_expenses` met dossier `Groene tafel` krijgen dossier `Samenwerking PCN` (via insert/update-tool, geen schemawijziging).
- Ontdubbeling in de dossierweergave gebeurt in de presentatielaag (`DossierOverzichtTab.tsx` / `DossierDetailDialog.tsx`) op basis van bedrag + datum binnen enkele dagen + genormaliseerde tegenpartij, in lijn met de bestaande ontdubbellogica in `useBudget.ts`.
