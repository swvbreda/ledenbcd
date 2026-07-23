## Doel
Alle transacties (inkomsten & uitgaven) uit Ponto ophalen en gebruiken om de begroting per dossier automatisch bij te werken.

## Aanpak

### 1. Transacties opslaan
Nieuwe tabel `ponto_transactions`:
- `account_id`, `transaction_id` (uniek), `executed_at`, `value_date`
- `amount` (negatief = uitgave, positief = inkomst), `currency`
- `counterparty_name`, `counterparty_iban`, `description`, `remittance_info`
- `category` (nullable, handmatig of via regel), `dossier_id` (nullable), `budget_category_id` (nullable)
- `raw` (jsonb), timestamps

### 2. Sync uitbreiden
`ponto-sync` edge function krijgt een `action` parameter:
- `balances` (huidige gedrag) — alleen saldi
- `transactions` — haalt per rekening `/accounts/{id}/transactions` op met paginering; incrementeel vanaf de laatste `executed_at`.
- `all` (default) — beide

### 3. Auto-koppeling aan dossiers/budget
Nieuwe tabel `ponto_matching_rules`:
- `pattern` (tekst die matcht op counterparty of omschrijving)
- `budget_category_id`, `dossier_id`
- `priority`

Na sync: elke ongekoppelde transactie wordt getoetst aan de regels en automatisch gelabeld. Handmatige overrides blijven behouden.

### 4. UI
- **Nieuw tabblad "Bankboekingen"** op /financien: lijst van Ponto-transacties met filters (periode, rekening, gekoppeld/ongekoppeld) en per rij een dropdown om dossier + budgetcategorie te kiezen.
- **Knop "Maak matchregel"** slaat de keuze op zodat vergelijkbare boekingen voortaan automatisch worden gelabeld.
- **DossierOverzichtTab** ("Begroting vs Werkelijk"): naast Informer-crediteuren nu ook Ponto-uitgaven meetellen, met een schakelaar (Ponto / Informer / beide) om dubbeltelling te voorkomen.
- **BankBalancesCard**: kleine "laatste boeking" indicator per rekening.

### 5. Sync-log
Bestaande `informer_sync_log` hergebruiken met action `pull_ponto_transactions` zodat alles op één plek zichtbaar blijft in de sync-tab.

## Open vragen (graag bevestigen vóór ik het bouw)

1. **Historie**: hoe ver terug de eerste keer syncen? (voorstel: vanaf 1 januari van het huidige boekjaar)
2. **Dubbeltelling met Informer**: als een boeking zowel in Ponto (bankmutatie) als in Informer (crediteurfactuur) staat, welke is leidend voor de "Werkelijk uitgegeven" kolom in Dossieroverzicht?
   - a) Ponto (banksaldo = waarheid)
   - b) Informer (factuurdatum, ook nog niet-betaalde)
   - c) Ponto voor uitgaven + Informer voor openstaand
3. **Automatisch of handmatig**: mogen boekingen zonder matchregel automatisch in een "Overig / nog te categoriseren" bucket vallen, of blijven ze volledig buiten de begroting tot iemand ze labelt?

## Technische details
- Ponto endpoint: `GET /accounts/{accountId}/transactions?page[limit]=100&page[before]=<cursor>`.
- Incrementeel: opslaan van hoogste `executed_at` per account in `ponto_bank_balances` of `informer_sync_state`.
- RLS: alleen bestuur/secretariaat mag lezen (zelfde patroon als `informer_bank_balances`).
- Migratie zet GRANTs, RLS en policies in één stap.
