# Dossier Worldline kloppend maken

Doel: in het dossier zie je precies de zeven Bureau Brandeis-facturen die erbij horen, met factuurdatum, factuurbedrag en de datum waarop ze betaald zijn — geen dubbele regels, geen opgeblazen bedragen.

## Wat er nu misgaat (gecontroleerd in de data)

- **Factuurbedrag telt dubbel.** Bij samengevoegde regels wordt het bedrag van de bankafschrijving én de factuurboeking bij elkaar opgeteld: 20260185 toont € 60.200,94 in plaats van € 30.100,47, en 20260435 € 6.787,52 in plaats van € 3.393,76.
- **Factuurdatums ontbreken** bij regels die alleen uit de bank komen (28-07, 24-06, 09-02).
- **Dubbele betaling 20260079** staat als drie losse regels: betaling 14-01 (€ 8.798,64), nogmaals meebetaald op 05-02, en terugstorting op 09-02.
- **Betaling 24-06 (€ 7.283,88)** hoort bij facturen 202506096 + 202506105, niet bij 20260688.

## Referentielijst (leidend)

| Factuur | Factuurdatum | Betaald op |
|---|---|---|
| 20260079 | 13-01-2026 | 14-01-2026 (dubbel betaald 05-02, teruggestort 09-02) |
| 20260185 | 11-02-2026 | 24-02-2026 |
| 20260306 | 10-03-2026 | 29-03-2026 (deel van € 23.512,06) |
| 20260435 | 08-04-2026 | 13-04-2026 |
| 20260688 | 15-06-2026 | nog niet betaald |
| 20260829 | 14-07-2026 | 28-07-2026 |
| 20260933 | 11-08-2026 | nog niet betaald |

De betaling van 24-06 (€ 7.283,88 voor 202506096 + 202506105) blijft als eigen regel staan.

## Wat ik ga doen

1. **Factuurgegevens corrigeren in de database**
   - Factuurdatums van de zeven facturen vastleggen zoals hierboven.
   - Ontbrekende factuurboekingen voor 20260688 en 20260933 aanmaken op dossier Worldline (openstaand, zonder betaaldatum) zodat ze zichtbaar zijn.
   - Bankregels 28-07 (20260829) en 24-06 koppelen aan hun facturen.

2. **Dubbele betaling samenvoegen**
   - De betaling van 05-02 (Worldline-deel € 8.798,64) en de terugstorting van 09-02 worden samengevoegd tot één regel met de opmerking "dubbele betaling — gecorrigeerd op 09-02-2026" en saldo € 0, zodat het dossiertotaal klopt.

3. **Factuurbedrag niet meer optellen**
   - In de samenvoeg-logica wordt het factuurbedrag per factuurnummer bepaald in plaats van opgeteld, zodat elk factuurnummer maar één keer met zijn echte bedrag meetelt.

4. **Nalopen en bevestigen**
   - Na de correcties controleer ik regel voor regel: elke factuur uit de lijst staat er één keer in, met de juiste factuurdatum, het factuurbedrag en de betaaldatum, en het dossiertotaal komt overeen met de werkelijke bankafschrijvingen. Ik rapporteer de uitkomst terug.

## Technisch

- Data-correcties via `budget_expenses` (factuurdatum, factuurnummer, dossier) en `ponto_transactions.dossier`; de bestaande `expense_dossier_splits` voor 05-02 en 29-03 blijven ongewijzigd.
- `dedupeEntries` in `src/hooks/useDossiers.ts`: `invoiceAmount` bepalen per unieke factuursleutel (`invoiceKey`) in plaats van cumulatief optellen.
- Tegengestelde bedragen op hetzelfde factuurnummer (betaling + terugstorting) worden herkend als correctie en samengevoegd met een toelichting in de bestaande tooltip.
