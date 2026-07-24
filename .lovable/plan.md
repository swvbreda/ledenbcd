## Waarom er dubbele boekingen staan

Elke Strategiebureau-betaling verschijnt twee keer omdat er twee bronnen naar dezelfde post lopen:

- **Ponto (live bankfeed)** — o.a. `2026-04-28 €7.550,40 fact.nr 2026-0008`
- **Bank statement upload (ABN CSV)** — dezelfde datum/bedrag/factuurnr., alleen anders geformatteerd

De transactie-dialoog voegt beide bronnen samen zonder ontdubbeling, dus dezelfde betaling staat er twee keer in.

Daarnaast liggen er nog oude `budget_expenses`-rijen uit de Informer/handmatige import (bijv. `2026-01-28` en `2026-02-24` bestaan én als bankboeking én als losse expense — soms zelfs twee keer met "Het Strategie Bureau" en "Het Strategiebureau"). Die zijn overbodig nu de bank leidend is.

## Plan

### 1. Ontdubbelen in de UI (dekt alle posten in één keer)
In de merge die `ExpenseDialog` voedt (`selectedLineItemExpenses` in `FinancienPage.tsx` / `useBudget.ts`):

- Bouw een sleutel per boeking: `abs(amount) | date | invoice_reference || counterparty-normalized`
- Prioriteit bij dubbels: **Ponto > bank_transactions > budget_expenses**
- Bij Ponto/bank match op dezelfde dag ±1: hou alleen Ponto
- Bij bank/ponto match met een `budget_expenses` (zelfde bedrag + factuurnr of zelfde bedrag + datum ±3 dagen + creditor): hou alleen de bankboeking

Zo verdwijnen alle visuele dubbels ook voor andere leveranciers zonder handmatig opruimen.

### 2. Eenmalige database-opschoning
Voor de rijen die aantoonbaar overbodig zijn:

- Verwijder `budget_expenses`-rijen waarvoor een bank- of Ponto-transactie bestaat met **hetzelfde factuurnummer én bedrag**.
- Voor Strategiebureau specifiek: verwijder de dubbele `budget_expenses` op 2026-01-28, 2026-02-10, 2026-02-24, 2026-03-26, 2026-04-29, 2026-05-29 (die corresponderen 1-op-1 met de bankboekingen).

Deze stap wordt in een aparte data-migratie voorgesteld zodat je de lijst eerst kunt goedkeuren.

### 3. Voorkomen van nieuwe dubbels
- In `ponto-sync` en de ABN-upload flow: als er al een boeking bestaat met hetzelfde `(date, amount, invoice_reference)` uit de andere bron, koppel deze aan de bestaande boeking (zelfde `line_item_id`/`dossier`) i.p.v. hem apart bij te schrijven.
- Voor `budget_expenses`: markeer bank-gerelateerde rijen als "bron: bank" en negeer ze bij nieuwe imports uit Informer als er al een bankmatch is.

## Technische details

- Bestanden: `src/pages/FinancienPage.tsx` (merge van bronnen), `src/hooks/useBudget.ts` (selectors), evt. `supabase/functions/ponto-sync/index.ts` voor stap 3.
- Sleutelnormalisatie: `invoice_reference` opschonen (`fact.nr `, spaties in `2026- 0006` → `2026-0006`), bedragen op 2 decimalen, datum ±1 dag tolerantie.
- Ontdubbeling is puur presentatie in stap 1 — data blijft bewaard tot je stap 2 goedkeurt.

## Vraag voor jou

Wil je dat ik ook stap 2 (database-opschoning) meteen meeneem, of eerst alleen stap 1 (UI-ontdubbeling) zodat je de bron-data intact houdt?
