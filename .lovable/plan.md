## Probleem

De Contributie-kaarten kloppen niet omdat ze rekenen met "aantal unieke leden × €3000":
- **130 facturen** voor 106 unieke leden (sommige leden hebben 2–3 facturen — deelbetalingen/meerdere shops) worden als 105 × €3000 = €315.000 getoond
- **107 leden als betaald** vs 105 gefactureerd → onmogelijke 102% en negatief openstaand
- 4 leden (#63, #65, #115, #117) staan als "betaald" via bankmatch maar hebben geen factuur in 2026 → zichtbaar in "Nog geen factuur verstuurd (11)" én tellen mee bij betaald

## Oplossing

### 1. Werkelijke bedragen tonen (bron: Informer)
- Nieuwe kolom `amount` op `contribution_invoices` (numeric)
- `informer-sync` vult die kolom bij het aanmaken/updaten van een factuurregel met het bedrag uit `invoiceAmount(inv)` (dat bedrag wordt al opgehaald voor `member_contributions`)
- Voor bestaande 130 rijen: back-fill vanuit `member_contributions.amount` per (member_id, year) als eenmalige update

### 2. Statistieken herberekenen in ContributieTab
- **Gefactureerd** = `sum(contribution_invoices.amount)` over alle 130 facturen van het jaar (niet aantal leden × €3000)
- **Ontvangen** = som van bedragen van gematchte bankbetalingen (`bankPaidMap`) + handmatige betalingen zonder bank-match, gecapt op het factuurbedrag per lid
- **Openstaand** = Gefactureerd − Ontvangen (nooit meer negatief zolang Ontvangen op factuurbedrag gecapt is)
- **Betaald teller** = leden met factuur die volledig betaald zijn, uit `stats.invoiced` — geen 107/105 meer
- Subtitel "X / Y leden" blijft leesbaar; naast het bedrag komt "N facturen" waar het aantal facturen relevant is

### 3. Automatisch factuur registreren bij betaling zonder factuur
Wanneer `bankPaidMap` een lid matcht dat geen factuur heeft in `contribution_invoices` voor dat jaar:
- direct een rij aanmaken in `contribution_invoices` met `invoice_number` = bankreferentie (of `AUTO-{member_id}-{jaar}` als leeg), `amount` = bedrag van de bankbetaling
- gebeurt in `useCreateContributionInvoice`-flow, aangeroepen vanuit een nieuwe effect in `ContributieTab` die door de bankmatch-map itereert
- Gevolg: de 4 leden (#63, #65, #115, #117) verdwijnen uit "Nog geen factuur verstuurd", worden zichtbaar in het Facturen-overzicht, en de tellingen komen weer in balans

### 4. Facturen van oud-leden
Lid #126 (member_type='old') heeft een factuur uit 2026. Facturen worden altijd geteld op basis van `contribution_invoices`, niet op `effectiveMembers` — dat gebeurt na deze wijziging automatisch goed omdat we sommeren over de tabel, niet over leden.

## Techniek

- **Migratie:** `ALTER TABLE contribution_invoices ADD COLUMN amount numeric(10,2)`, back-fill via `UPDATE ... FROM member_contributions`, geen RLS-wijziging
- **Edge function:** `supabase/functions/informer-sync/index.ts` regels 543–550 uitbreiden met `amount`
- **Hook:** `useContributions.ts` → `ContributionInvoice` type + `useCreateContributionInvoice` krijgen `amount`
- **Component:** `src/components/budget/ContributieTab.tsx` — `stats` en `bankPaidMap`-gebruik herschrijven, nieuw effect voor auto-factuur-registratie
- **Bijeffect:** `FacturenOverzichtTab.tsx` gebruikt nu ook echte factuurbedragen (nu nog `amount = yearSettings?.contribution_amount`)

## Buiten scope
- Wijzigingen aan `DossierOverzichtTab` / Ponto — die staan los van deze telling
- Formuleren van nieuwe bank-matchregels
