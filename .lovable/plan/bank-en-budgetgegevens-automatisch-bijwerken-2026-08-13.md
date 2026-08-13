# Bank- en budgetgegevens automatisch bijwerken

## Wat er nu aan de hand is

Gecontroleerd in de database:

- Er draaien maar twee geplande taken: de maandelijkse vergoedingen en de dagelijkse Outlook-contactensync. **Er is geen geplande taak voor de banksync (Ponto) of voor Informer.** Beide draaien alleen wanneer iemand handmatig op "Bank ophalen" of "Synchroniseren" klikt in Financiën.
- Laatste banktransactie in het systeem: 28 juli 2026. Laatste Informer-run: vandaag 13:33 (handmatig gestart).
- In die laatste run mislukte het onderdeel *facturen* met een databasefout: een Informer-debiteur wordt gekoppeld aan een lidnummer dat niet (meer) in de ledentabel bestaat. Dit onderdeel faalt al sinds ten minste 30 juli, dus facturen komen ook bij een handmatige sync niet binnen.
- Op 30 juli liep Informer bovendien tegen een "te veel verzoeken"-limiet (429) aan.

Kort: het gaat niet automatisch omdat het nooit is ingepland, en de facturenstap loopt daarnaast vast op een koppelfout.

## Wat ik ga doen

1. **Automatische banksync inplannen** — elke dag (bijv. 06:00 en 18:00) worden banksaldi en banktransacties opgehaald en langs de bestaande herkenningsregels gelegd, precies zoals de knop nu doet.
2. **Automatische Informer-sync inplannen** — dagelijks debiteuren, facturen, crediteuren en banksaldi ophalen.
3. **Facturenstap repareren** — voordat een debiteur aan een lid wordt gekoppeld, controleren of dat lidnummer bestaat; zo niet, de koppeling overslaan en als aandachtspunt loggen in plaats van de hele stap te laten crashen.
4. **Beter omgaan met de limiet van Informer** — bij een 429 kort wachten en opnieuw proberen, zodat een run niet meteen sneuvelt.
5. **Zichtbaarheid in Financiën** — per bron tonen wanneer er voor het laatst succesvol gesynchroniseerd is, met een duidelijke waarschuwing als dat langer dan 48 uur geleden is, plus de laatste foutmelding.

## Technisch

- Cron via pg_cron + pg_net, net als de bestaande taken, met de service-role sleutel uit de vault (zoals `email_queue_dispatch` doet) in plaats van de anon key.
- Jobs: `ponto-sync?action=all` (2x per dag) en `informer-sync?action=all` (1x per dag, buiten de banksync-tijden om piekbelasting te voorkomen).
- `informer_sync_state` wordt bij elke run bijgewerkt zodat de UI de laatste sync-tijden kan tonen (tabel is nu leeg).
- Aanpassingen in `supabase/functions/informer-sync/index.ts` (bestaanscontrole lidnummer + retry bij 429) en in `src/components/budget/InformerSyncTab.tsx` / `BankboekingenTab.tsx` voor de statusweergave.
