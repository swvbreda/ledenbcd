# Financiële module: Informer als enige bron van waarheid

## Wat ik in code en database heb gecontroleerd

- **Vier parallelle bronnen tellen nu door elkaar heen.** In de database staan: `budget_expenses` 229 uitgaafregels uit vier verschillende bronnen (`import` 117 / €148.982, `pdf_import` 29 / €147.833, `manual` 57 / €114.251, `informer` 26 / €0), `bank_transactions` (oude PDF-import, 100 uit / €219.354), `ponto_transactions` (191 uitgaande regels) en `contribution_payments`. Elke combinatie levert een ander uitgaventotaal — dat verklaart de drie bedragen op één pagina.
- **`useFinancialResult` telt alle Ponto-mutaties rechtstreeks op** (`src/hooks/useBudget.ts` regel 480-505), volledig los van Informer.
- **`useBudget` kiest per jaar een voorkeursbron** via `budget_year_settings.expense_source_preference` (`manual` of `pdf_import`) en ontdubbelt daarnaast heuristisch via `src/lib/ledgerDedupe.ts` (bedrag ±€0,50, datumvenster 10 dagen, genormaliseerde tegenpartij). `useDossiers` doet dat nogmaals met eigen regels.
- **Contributie loopt uit de pas:** 120 facturen / €342.500, 121 betalingen / €344.000, 122 `member_contributions` / €355.500. Drie tabellen, drie totalen.
- **`pull_creditors`** (`supabase/functions/informer-sync/index.ts` r. 838-870) haalt inkoopfacturen op vanaf de laatste sync minus 7 dagen — een voortschrijdend venster — en hangt alles aan één "Informer-import"-begrotingspost. De 26 regels met bron `informer` staan op €0.

### Beperkingen van de Informer-API (waargenomen in de huidige code)

- Het `last_edit`-filter geeft een 400 op inkoopfacturen; alles moet gepagineerd opgehaald en zelf gefilterd worden.
- 429-rate limits komen voor (er zit al een retry op).
- Bankrekeningen komen via `/journals?type=1`; er is **geen betrouwbaar grootboekmutatie-endpoint** in gebruik — alleen `/invoices/sales`, `/invoices/purchase`, `/relations`, `/journals`.
- Status komt uit een genest en wisselend veld (`status.status` of `status`); concepten heten "Draft"/"Concept".
- Verwijderde records zijn niet als "deleted"-event op te halen; alleen afwezigheid in een volledige jaarophaling verraadt ze.

Gevolg: als Informer een grootboekrubriek of controletotaal niet levert, tonen we "niet beschikbaar / niet gereconcilieerd" in plaats van een schatting.

## Aanpak

### 1. Eén canonieke tabel per boekjaar

Nieuwe tabel `informer_ledger_entries` — de enige bron voor werkelijke bedragen:

- `informer_id` (stabiel), `doc_type` (`sales_invoice` / `purchase_invoice`), `year`, `entry_date`, `due_date`, `amount_excl`, `amount_incl`, `paid_amount`, `open_amount`, `status_raw` + genormaliseerde `status` (`draft` / `open` / `paid` / `cancelled` / `unprocessed`), `relation_id`, `relation_name`, `invoice_number`, `ledger_account` (nullable), `currency`, `raw` (jsonb), `last_synced_at`, `deleted_at`.
- Unieke sleutel op (`doc_type`, `informer_id`) → idempotente upsert.
- Lokale, blijvende bewerkingen in een aparte tabel `ledger_entry_overrides` (dossier, begrotingspost, notitie, "uitsluiten") met dezelfde sleutel, zodat een sync ze nooit overschrijft.
- Alleen posten met status `open`/`paid` tellen mee in werkelijke bedragen; `draft`/`unprocessed`/€0 (de vier OpenAI-facturen) en `cancelled` verschijnen als aandachtspunt, niet in totalen.
- Grootboekrubriek komt uit Informer; is die leeg, dan "niet gerubriceerd" — geen lokale correctie (LEAP NL €55 blijft dus Reiskosten).

### 2. Ponto strikt naar reconciliatie

- Nieuwe tabel `ledger_payment_links` (`informer_doc_type`, `informer_id`, `ponto_transaction_id`, `matched_by` `auto|manual`, `confidence`) met unieke Ponto-id.
- Ponto levert nog uitsluitend: actueel banksaldo, betaaldatum bij een gekoppelde post, en de werklijst "ongekoppelde bankmutaties". Nergens meer een eigen bedrag in begroting, resultaat of dossier.
- `useFinancialResult` wordt volledig herschreven op de canonieke tabel.

### 3. Bestaande tabellen

| Tabel | Besluit |
| --- | --- |
| `budget_categories`, `budget_line_items`, `budget_year_settings` | Blijven — lokale begroting blijft bewerkbaar |
| `budget_expenses` | Alleen historisch; niet meer in totalen. Regels met `external_id` worden gemapt op de canonieke post |
| `bank_transactions` (oude PDF-import) | Bevriezen als historie, uit alle overzichten |
| `ponto_transactions`, `ponto_bank_balances` | Blijven, maar alleen voor saldo/reconciliatie |
| `contribution_invoices`, `contribution_payments`, `member_contributions` | Worden afgeleide weergaven van de canonieke verkoopfacturen; `member_contributions` behoudt alleen lokale velden (vrijstelling, notities) |
| `expense_dossier_splits`, `expense_documents` | Blijven, sleutel verschuift naar de canonieke `informer_id` |
| `informer_debtor_map` | Blijft de koppeling factuur → lid |
| `budget_year_settings.expense_source_preference` | Vervalt (geen bronkeuze meer) |

### 4. Sync per boekjaar

`informer-sync` krijgt `action=sync_year&year=YYYY`: volledige gepagineerde ophaling van verkoop- én inkoopfacturen voor dat jaar, upsert op `informer_id`, en alles wat in Informer niet meer voorkomt krijgt `deleted_at`. Statuswijzigingen (betaald, geannuleerd, bedrag aangepast) volgen automatisch. Resultaat per run wordt weggeschreven in `informer_sync_state` en `informer_sync_log`: aantallen geïmporteerd / gewijzigd / verwijderd / gematcht / uitgesloten.

### 5. Contributie uit Informer

Verkoopfacturen → lid via `informer_debtor_map`. Betaald/open komt uit `paid_amount`/`open_amount` van Informer, niet uit de bank. Niet-matchende facturen komen in een zichtbare uitzonderingenlijst in plaats van stil te verdwijnen. Vrijstellingen (`contribution_exemptions`) blijven ongewijzigd werken.

### 6. UI-omzetting

- Nieuw tabblad **Controle & sync**: laatste geslaagde sync per actie, tellingen, ontbrekende debiteurkoppelingen, Informer-documenten met status "te verwerken", ongekoppelde bankmutaties, en een vergelijking van kerntotalen (uitgaven, opbrengsten, resultaat, openstaande verkoopfacturen) tussen Informer en de app.
- `useBudget`, `useFinancialResult`, `useDossiers`, `ContributieTab`, `OpenstaandePostenTab`, `BudgetVsActualTable`, `BoekingenOverzicht`, `DossierOverzichtTab` lezen allemaal via één nieuwe hook `useLedger(year)`.
- `ledgerDedupe.ts` wordt niet meer gebruikt voor totalen, alleen nog als matchhulp bij bankreconciliatie.
- Dossier en split hangen aan de canonieke post en tellen exact één keer; splits moeten optellen tot het factuurbedrag, anders een waarschuwing.

### 7. Migratie en backfill (veilig)

1. Nieuwe tabellen aanmaken met RLS + GRANTs, schrijfpolicies admin/penningmeester; eventuele views met `security_invoker = on`.
2. Volledige jaarsync 2026 draaien (leest alleen).
3. Bestaande dossiertoewijzingen en splits overzetten naar `ledger_entry_overrides` via `budget_expenses.external_id` en factuurnummer; wat niet eenduidig te koppelen is komt op de uitzonderingenlijst — niets wordt geraden.
4. Bestaande Ponto-dossiervelden omzetten naar `ledger_payment_links` waar een eenduidige factuurkoppeling bestaat.
5. Pas daarna de UI omzetten. Oude tabellen blijven onaangeroerd, dus terugdraaien kan altijd.

### 8. Tests die dubbeltelling uitsluiten

- Unit: som canonieke uitgaven == som per dossier == som in begroting-vs-werkelijk (één functie, drie weergaven).
- Unit: een Ponto-mutatie met en zonder koppeling verandert het uitgaventotaal niet.
- Unit: post met status `draft`/€0 telt niet mee maar staat wel in de aandachtspuntenlijst (de vier OpenAI-facturen).
- Unit: splits over meerdere dossiers sommeren exact tot het factuurbedrag.
- Idempotentie: dezelfde sync twee keer draaien geeft identieke rijen en totalen; een handmatig dossier blijft na sync staan.
- Acceptatie op de huidige administratie: uitgaven €275.797,00, opbrengsten €349.574,79, resultaat €73.777,79, openstaande verkoopfacturen €54.500,00 — als vergelijking in de controlemodule, niet hardcoded.
- Grep-test: geen enkel component leest nog rechtstreeks `bank_transactions` of telt `ponto_transactions` op.
