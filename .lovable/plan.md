# Plan: Bankiert-bij sectie verbeteren op Kerngegevens

## Doel
De "Bankiert bij"-sectie op de Kerngegevens-pagina moet visueel netter uitgelijnd worden (meer lucht boven de titel) en de bankverdeling moet als taartdiagram (cirkeldiagram) worden getoond in plaats van de huidige horizontale balken.

## Te wijzigen bestanden

### 1. `src/pages/KerngegevensPage.tsx`
- Extra marge/padding boven de "Bankiert bij" sectie toevoegen zodat de titel niet meer te hoog/klemt.
- De horizontale `Balk` + lijst voor bankgroepen vervangen door een cirkeldiagram (pie/donut chart).
- Een compacte legenda naast of onder het diagram tonen met banknaam, aantal leden en percentage.
- De bestaande klik-functionaliteit (detaildialog openen bij klik op een bank) behouden, nu gekoppeld aan legenda-segmenten.
- Gebruik maken van een bestaand chart-component als beschikbaar, of een inline SVG-donut met kleurcodes.

### 2. `package.json` / afhankelijkheden (alleen indien nodig)
- Indien er al een chart-library in het project zit (bijv. `recharts`), gebruik die. Zo niet, voeg geen nieuwe zware library toe maar implementeer het als inline SVG.

## Technische details
- Behoud de huisstijl: primaire roodtint voor het grootste segment, grijstinten voor de overige segmenten, donkergrijze hover-state.
- Tabellarische aantallen blijven `tabular-nums`.
- Responsive: op mobiel onder elkaar, op desktop eventueel diagram links en legenda rechts.
- Geen wijziging in data of `useKerngegevens.ts`; alleen presentatie.

## Acceptatiecriteria
- De "Bankiert bij"-titel staat visueel lager / met meer lucht dan nu.
- De bankverdeling wordt getoond als een taartdiagram (donut mag ook).
- Klikken op een segment/legenda opent nog steeds het detailoverzicht van leden die bij die bank horen.
- De rest van de pagina blijft onveranderd werken.
