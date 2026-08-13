# Crediteuren-sync uit Informer repareren

## Wat er mis is (gecontroleerd)

In de synclogboeken faalt alleen de stap **crediteuren**, bij elke run:

- `pull_creditors` → `Informer 400` (laatste runs: vandaag 14:49 en 14:51). Alle andere stappen (debiteuren 121, facturen 5, banksaldi 3) slagen.
- De crediteurenstap roept Informer aan met een filterparameter (`/invoices/purchase?last_edit=...`) die de andere, wél werkende stappen niet gebruiken. De verkoopfacturen worden opgehaald met normale paginering (`records`/`page`) en die aanroep geeft geen fout.

Conclusie: de 400 komt van de afwijkende filterparameter op de inkoopfacturen, niet van een authenticatie- of rechtenprobleem.

## Wat ik ga doen

1. **Inkoopfacturen op dezelfde manier ophalen als verkoopfacturen** — via paginering in plaats van de `last_edit`-filter, zodat de aanroep dezelfde vorm heeft als de aanroep die aantoonbaar werkt.
2. **Zelf filteren op periode** — na het ophalen alleen facturen verwerken vanaf de laatst geslaagde crediteurensync (met een marge), zodat er niet onnodig oude boekingen opnieuw worden weggeschreven. Koppeling blijft op `external_id`, dus dubbele boekingen zijn uitgesloten.
3. **Fallback als de paginering ook een 400 geeft** — dan wordt de kale aanroep zonder parameters geprobeerd voordat de stap als mislukt wordt gemarkeerd, en wordt de foutmelding van Informer zelf (in plaats van alleen de statuscode) in het logboek gezet.
4. **Ruis in het logboek beperken** — de waarschuwing "relatienummer zonder bestaand lid overgeslagen" (nu relatienummer 1000) wordt samengevat in plaats van per run herhaald als losse waarschuwing.
5. **Controleren** — na de aanpassing de sync handmatig starten en in het logboek bevestigen dat `pull_creditors` slaagt.

## Technisch

- Aanpassing in `supabase/functions/informer-sync/index.ts`, functie `pullCreditors`: `informerCall("/invoices/purchase?last_edit=...")` vervangen door `fetchAllInformerPages("/invoices/purchase", ["purchase", "invoices", "data"], api_calls)`, plus datumfilter op `invoice_date`/`date` tegen `informer_sync_state.last_creditor_sync_at`.
- Foutafhandeling: bij een niet-OK respons de body via `hasInformerError` uitlezen en meesturen in `error_message` van `informer_sync_log`.
- Geen databasewijzigingen nodig; de bestaande upsert op `budget_expenses.external_id` blijft ongewijzigd.
