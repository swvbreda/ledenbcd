# Financiën: tabbladen opschonen

Van 10 naar 7 tabbladen. Alleen de UI verandert; de onderliggende data en de ontdubbeling in begroting/dossiers blijven zoals ze zijn.

## Wat weggaat

- **Controle uitgaven** — verwijderen. Een betaling zonder dossier is meestal geen fout, dus die lijst geeft valse alarmen.
- **Harde check** — verwijderen.
- **Leden & betalingen** — verwijderen; dit toont dezelfde contributiegegevens als Contributie (verschuldigd, betaald, openstaand, factuurnummer per lid), alleen als filterbare lijst. Contributie blijft.

## Wat blijft

Dashboard · Declaraties · Contributie · Inkomsten/Uitgaven · Dossiers · To Do · Informer

## Aandachtspunt

Contributie toont nu per lid: bedrag, factuur, betaalstatus (afgeleid van de bank) en uploadknoppen. De zoek-/statusfilter en de KPI-kaarten uit Leden & betalingen zitten daar niet in. Standaard laat ik Contributie ongewijzigd; zeg het als je die zoekbalk en statusfilter er alsnog bij wilt.

## Technisch

- `src/pages/FinancienPage.tsx`: tabs `controle`, `check` en `leden-betalingen` (triggers + contents + imports) verwijderen.
- Bestanden verwijderen: `src/components/budget/ControleUitgavenTab.tsx`, `HardeCheckTab.tsx`, `LedenBetalingenTab.tsx`.
- Bestaande redirect `/leden-betalingen` laten wijzen naar `/financien`.
- `src/lib/ledgerDedupe.ts` blijft in gebruik door `useBudget.ts` en `useDossiers.ts` — niet aanraken.
- Controleren of `HardeCheckTab`/`LedenBetalingenTab` nergens anders geïmporteerd worden voordat ze weg gaan.
