# Declaraties koppelen aan de juiste betalingen

## Wat er nu misgaat (gecontroleerd in de data)

De 15 declaraties hangen wel aan het juiste dossier, maar bijna allemaal aan de **Informer-boeking** (`expense:...`), niet aan de **bankbetaling** (`ponto:...`). Voorbeelden:

- Declaratie 20260079 hangt aan de Informer-boeking van 14-01; de bankbetaling van 14-01 (€ 8.798,64) heeft geen factuur en zelfs geen dossier.
- Vier declaraties (20260688, 20260767, 20260922, 20260933) hangen alleen aan het dossier, zonder enige betaling.
- Meerdere betalingen dekken twee declaraties tegelijk ("fac nrs 20260306+20260297", "20260079+20260165"). Daar hoort dus meer dan één factuur bij één betaling.
- Enkele Brandeis-bankbetalingen staan nog zonder dossier (o.a. 14-01, 05-02, 24-02, 16-03 en de terugbetaling "Dubbele betaling 20260079").

## Wat we bouwen

### 1. Automatisch koppelen op declaratienummer
Een eenmalige opschoning die per factuur het declaratienummer uit de bestandsnaam haalt en dat vergelijkt met het declaratienummer in de omschrijving van elke bankbetaling. Betalingen met meerdere nummers in de omschrijving krijgen alle bijbehorende facturen. Ook de bankbetalingen zelf krijgen daarmee het juiste dossier (Worldline / Amsterdam i-criterium).

Waar zowel de Informer-boeking als de bankbetaling bestaat, wordt de factuur aan **beide** zichtbaar gekoppeld, zodat de factuur nooit verdwijnt afhankelijk van welke bron je bekijkt.

### 2. Facturen delen binnen een samengevoegde regel
In het dossieroverzicht worden bank- en Informer-regels al als één regel getoond. De factuurweergave gaat de documenten van álle onderliggende bronnen van die regel tonen in plaats van alleen die van de bovenste bron.

### 3. Handmatig koppelen in het dossierdetail
Per factuur komt er een knop "Koppelen aan betaling": je kiest een mutatie uit het dossier en de factuur verhuist daarheen. Zo kunnen de vier losse declaraties (20260688, 20260767, 20260922, 20260933) aan hun betaling gehangen worden zodra die er is, en kun je een verkeerde koppeling corrigeren.

### 4. Signalering
In het dossierdetail markeren we betalingen zonder factuur en facturen zonder betaling, zodat direct zichtbaar is wat nog open staat.

## Technische aanpak

- SQL-opschoning op `expense_documents`: declaratienummer uit `invoice_reference`/`file_name` matchen tegen `ponto_transactions.description` (regex op alle nummers in de omschrijving) en tegen `budget_expenses.invoice_reference` (genormaliseerd, spaties eruit). Nieuwe rijen invoegen voor de bank-entry-key; bestaande rijen behouden. Betreffende `ponto_transactions.dossier` bijwerken waar leeg.
- `dedupeEntries` in `src/hooks/useDossiers.ts` levert al `sources`; `DossierDetailDialog.tsx` gaat de documentenmap over alle `sources[].key` samenvoegen.
- `DossierDetailDialog.tsx`: extra actie per document dat `entry_key` van een document bijwerkt naar de gekozen mutatiesleutel, via een nieuwe `relink`-mutatie in `useExpenseDocumentActions`.
- Geen schemawijziging nodig; `expense_documents` heeft al `entry_key`, `dossier` en `invoice_reference`.
