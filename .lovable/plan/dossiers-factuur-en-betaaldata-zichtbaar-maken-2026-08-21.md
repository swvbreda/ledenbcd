# Dossiers: factuur- en betaaldata zichtbaar maken

## Doel
In ieder dossier direct kunnen zien wanneer een factuur is gedateerd en wanneer deze daadwerkelijk via de bank is betaald, zonder dat samengevoegde regels deze informatie verbergen.

## Aanpassingen

1. **Twee aparte datumvelden per regel**
   - **Factuurdatum** komt uit de gekoppelde Informer-/factuurboeking (`budget_expenses.expense_date`).
   - **Betaaldatum** komt uit de echte banktransactie (`ponto_transactions.executed_at`).
   - Ontbrekende waarden worden als `—` getoond en niet vervangen door een andere soort datum.

2. **Samengevoegde betaling volledig houden**
   - De dossierdata bewaart beide datums wanneer een bankbetaling en factuurboeking als dezelfde betaling worden samengevoegd.
   - Bij één betaling voor meerdere facturen blijven alle gevonden factuurnummers zichtbaar.
   - De bankbetaling blijft leidend voor het bedrag; factuurgegevens worden alleen gebruikt voor factuurnummer, factuurdatum en documentkoppeling.

3. **Dossieroverzicht duidelijker maken**
   - De huidige algemene kolom **Datum** vervangen door **Factuurdatum** en **Betaaldatum**.
   - Dit zowel in de uitgeklapte dossierlijst als in het detailvenster toepassen.
   - De bestaande factuurindicator en het aantal samengevoegde bronnen blijven zichtbaar, zodat mogelijke dubbelingen controleerbaar zijn.

4. **Controleren met echte administratiegegevens**
   - Verifiëren met bekende Bureau Brandeis-regels waar beide datums in de database aanwezig zijn.
   - Controleren dat regels niet opnieuw dubbel worden geteld en dat factuurafbeeldingen gekoppeld blijven.

## Technisch
- `src/hooks/useDossiers.ts`: aparte `invoiceDate` en `paymentDate` toevoegen aan het dossiermodel en tijdens `dedupeEntries` uit alle onderliggende bronnen samenvoegen.
- `src/components/budget/DossierOverzichtTab.tsx`: beide datumkolommen tonen.
- `src/components/budget/DossierDetailDialog.tsx`: beide datumkolommen tonen en de betaalkeuze herkenbaar maken met factuur- en betaaldatum.
- Geen databasewijziging nodig: de factuurdatum en betaaldatum zijn al aanwezig in de huidige factuur- en bankgegevens.
