## Wat er nu misgaat

De bovenste rijen in het facturenoverzicht zijn geen contributiefacturen, waardoor het lijkt of Informer niet gesynct wordt. Twee bronnen van "vervuiling":

1. **Twee rijen met `invoice_number = "SEPA Overboeking IBAN: ..."`** (leden #65 en #115, aangemaakt 12:02) — restant van een eerdere auto‑registratie vanuit een bankmatch waarbij de bank‑omschrijving als factuurnummer is opgeslagen. Deze code staat niet meer in de repo, maar de rijen bestaan nog.
2. **Vier rijen `2026-0001 t/m 2026-0004`** met bedragen €15.000 / €10.000 / €630 / €500 voor leden #1, #2, #8, #12 (aangemaakt 12:04 door de laatste `informer-sync`‑run). Dit zijn echte Informer‑verkoopfacturen, maar geen contributie — het zijn sponsor-/donatiefacturen uit een andere nummerreeks (met streepje). De echte contributiefacturen in Informer hebben nummers als `2026068`, `2026101`, `2025180` (zonder streepje) en bedragen van €3.000/€1.000.

De huidige `pullInvoices` in `supabase/functions/informer-sync/index.ts` importeert álle sales-facturen van gekoppelde debiteuren en schrijft ze zowel in `member_contributions` als in `contribution_invoices`. Er wordt niet gefilterd op "contributie".

## Wat we gaan doen

### 1. Informer‑sync filteren op contributiefacturen
In `pullInvoices` een filter toevoegen dat alleen contributiefacturen accepteert. Combinatie van criteria (alle moeten waar zijn):
- Factuurnummer bevat **geen streepje** en matcht patroon `^20\d{6}$` (formaat `2026068`, `2025180`) — sluit `2026-0001` reeks uit.
- Bedrag ≥ €500 en ≤ 2× `contribution_amount` uit `budget_year_settings` (dekt gedeeltelijke betalingen zoals #52 met €1.000 en volledig €3.000, sluit uitschieters €10k/€15k uit).

Deze regels blokkeren de nu zichtbare vervuiling zonder de goede rijen te raken. Niet-contributiefacturen worden overgeslagen (niet in `contribution_invoices` én niet in `member_contributions`), zodat het dashboard puur over contributie gaat.

### 2. Bestaande foute rijen opruimen (via migratie)
```sql
DELETE FROM contribution_invoices
 WHERE invoice_number LIKE 'SEPA%'
    OR invoice_number ~ '^20\d{2}-\d{4}$';

DELETE FROM member_contributions
 WHERE year = 2026
   AND invoice_number ~ '^20\d{2}-\d{4}$';
```
De bijbehorende bankboekingen blijven bestaan, en zijn indien nodig alsnog te koppelen aan de juiste (nieuwe) contributiefactuur.

### 3. Sync opnieuw laten lopen
Na de code‑ en migratieaanpassing één keer `informer-sync` triggeren zodat de correcte contributiefacturen (2026068, 2026101 e.d.) bovenaan verschijnen, gesorteerd op invoice_date / created_at.

## Waar het overzicht daarna aan voldoet
- Bovenaan: de meest recente contributiefacturen uit Informer, met echte factuurnummers en bedragen ≈ €3.000.
- Geen "SEPA Overboeking…"‑rijen meer.
- Geen sponsor‑/donatiefacturen meer in de contributielijst.
- Totalen (Nog te versturen / Verstuurd / Betaald) worden weer inhoudelijk kloppend.

## Vraag ter bevestiging
Klopt het dat Informer contributiefacturen altijd de vorm `YYYYNNN` hebben (bv. `2026068`) en dat de reeks met streepje (`2026-0001`) puur voor sponsoring/overig gebruikt wordt? Zo ja, dan volstaat het filter hierboven. Als er nog een andere kenmerk is (bv. dagboek, productcode, of "Contributie" in de omschrijving), noem dat dan even, dan neem ik dat mee als extra criterium.
