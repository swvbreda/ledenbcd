
## Doel
Twee-richtingsverbinding tussen het ledenportaal en Informer (REST API), elk uur automatisch + handmatige "Synchroniseer nu" knop.

## Onderdelen

**1. Secrets (beveiligd formulier)**
- `INFORMER_API_TOKEN` — het token uit Informer
- `INFORMER_ADMINISTRATION_ID` — administratie-ID/subscription
- `INFORMER_BASE_URL` — meestal `https://api.informer.eu/v1` (default als leeg)

**2. Edge function: `informer-sync`**
Eén orkestratie-functie die drie acties draait, met `?action=push_invoices|pull_payments|pull_creditors|all`:

- **push_invoices** — Loop over `member_contributions` waar `invoice_number IS NULL` en `paid = false`. Maak verkoopfactuur in Informer (POST `/sales_invoices`), schrijf het Informer-factuurnummer + `external_ref` terug naar `member_contributions.invoice_number` en nieuwe kolom `external_invoice_id`.
- **pull_payments** — GET facturen met status `paid` sinds `last_sync_at`. Match op `external_invoice_id` → markeer `paid = true`, `paid_date`.
- **pull_creditors** — GET inkoopfacturen sinds laatste sync. Upsert naar `budget_expenses` met `source = 'informer'` en `external_id`. Skip duplicates op `external_id`.

**3. Database-migratie**
- `member_contributions`: kolom `external_invoice_id text` toevoegen
- `budget_expenses`: kolommen `source text default 'manual'`, `external_id text unique` toevoegen
- Nieuwe tabel `informer_sync_log` (run_at, action, success, items_processed, error_message) voor monitoring
- Nieuwe tabel `informer_sync_state` (id=1, last_payment_sync_at, last_creditor_sync_at)

**4. Cron job (elk uur)**
`pg_cron` job die `informer-sync?action=all` aanroept met service role auth.

**5. UI**
- `src/pages/FinancienPage.tsx`: knop **"Synchroniseer met Informer"** (admin-only) in de header → toont laatste sync-tijd + spinner
- Nieuwe component `InformerSyncStatus.tsx`: toont laatste 10 sync-logs (succes/fout, aantal items) onder een nieuw tabblad **"Informer"** in Financiën
- Bij elke crediteur uit Informer een klein badge "Informer" in `ExpenseListView.tsx`

**6. Foutafhandeling**
- API-fouten → log naar `informer_sync_log` met error message
- Bij 401 → toast "Informer-token verlopen, controleer secrets"
- Geen retries in dezelfde run; volgende uur probeert opnieuw

## Volgorde
1. Migratie (kolommen + tabellen)
2. Secrets-formulier voor token + admin-ID
3. Edge function `informer-sync` schrijven
4. UI-knop + tabblad
5. Cron arm op elk uur
6. Eerste handmatige run om te testen
