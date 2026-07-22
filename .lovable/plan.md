# Informer-uitbreiding: bankstatus + uitgaven per dossier + begroting-vs-werkelijk

Goed nieuws: veel bouwstenen zijn er al. `budget_expenses` heeft een `dossier`-kolom, `DossierOverzichtTab` kan al handmatig uitgaven aan dossiers koppelen, en `pull_creditors` importeert al inkoopfacturen uit Informer. Ik breid dat gericht uit met drie dingen.

## 1. Bankstatus ophalen uit Informer

**Backend:**
- Nieuwe tabel `informer_bank_balances` (bank-rekening-id, naam, saldo, valuta, `as_of_date`).
- Extra kolom `last_bank_sync_at` op `informer_sync_state`.
- Nieuwe actie `pull_bank_balances` in de edge function `informer-sync`. Deze probeert de Informer bank-journalen op te halen (`/journals?type=bank` met fallback naar `/ledger_accounts?type=bank`), normaliseert het resultaat en upsert per rekening.
- De volledige sync (`action=all`) draait deze nieuwe actie automatisch mee.

**UI:**
- Bovenaan het financieel dashboard een nieuwe kaart **"Banksaldi (Informer)"** met per rekening: naam, saldo, laatst bijgewerkt.
- In de Informer-tab: een regel "Laatste bank-sync: …" plus een aparte knop "Alleen banksaldi ophalen".

## 2. Uitgaven per dossier (blijft handmatig toewijzen)

Zoals afgesproken: importeren gebeurt zonder categorie, jij wijst ze toe.

- Kleine verbetering in `DossierOverzichtTab`: bovenaan een filter/tel-regel "X ongekoppelde uitgaven — wijs toe" die je direct naar het "Nieuw dossier"-dialog brengt, zodat nieuwe Informer-imports niet uit beeld raken.
- Uitgaven die al via `pull_creditors` in `budget_expenses` staan verschijnen automatisch mee (dat werkt vandaag al).

## 3. Begroting-vs-werkelijk

Nieuw paneel bovenaan de Dossiers-tab:

- **Totaal begroot** (som van `budget_line_items.budgeted_amount` voor het jaar) vs **totaal uitgegeven** (som van alle uitgaande `budget_expenses` + `bank_transactions` van dat jaar) met progress-bar en "resterend".
- Daaronder een tabel per **begrotingscategorie**: begroot / uitgegeven / % gebruikt / resterend.
- En een tabel per **dossier**: dezelfde kolommen, waarbij "begroot" leeg blijft voor dossiers zonder begroting-koppeling (dossiers zijn vrijetekst; ze horen bij de categorie waar hun uitgaven onder staan).

## Technische details

**Migratie**
```sql
CREATE TABLE public.informer_bank_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text UNIQUE NOT NULL,
  name text,
  balance numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'EUR',
  as_of_date date,
  raw jsonb,
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.informer_bank_balances TO authenticated;
GRANT ALL ON public.informer_bank_balances TO service_role;
ALTER TABLE public.informer_bank_balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins/board can view bank balances"
  ON public.informer_bank_balances FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.is_board_member(auth.uid()));

ALTER TABLE public.informer_sync_state ADD COLUMN IF NOT EXISTS last_bank_sync_at timestamptz;
```

**Edge function**: `pullBankBalances(supabase)` in `informer-sync/index.ts`, met dezelfde `informerCall`/`normalizeInformerList`-helpers en fout-tolerantie als de bestaande acties. Endpoint-keuze wordt volgorde-gewijs geprobeerd; alle API-calls worden in `api_calls` gelogd zodat je bij twijfel in de sync-log kunt zien welke Informer-response terugkwam.

**Front-end**
- Nieuwe component `src/components/budget/BankBalancesCard.tsx` (leest `informer_bank_balances`).
- `FinancienPage.tsx`: kaart toegevoegd bovenaan het dashboard-tab.
- `DossierOverzichtTab.tsx`: nieuw paneel "Begroting vs Werkelijk" bovenaan; totalen berekend uit de al aanwezige `categories` prop (geen extra query nodig).
- `InformerSyncTab.tsx`: extra knop + `last_bank_sync_at` regel.

## Onzekerheid

Ik weet niet 100% welk Informer-endpoint jullie account gebruikt voor bank­saldi (v2 kan `/journals`, `/ledger_accounts` of `/bank_accounts` zijn). De function probeert een paar varianten en logt de responses in `informer_sync_log`; als de eerste run 0 rekeningen geeft, kijk ik in de log en pas ik het endpoint aan.
