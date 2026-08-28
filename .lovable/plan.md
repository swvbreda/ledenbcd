# Overige inkomsten staan weer op nul

## Wat ik in de database zie

De post **Donaties en overige baten** (Inkomsten, 2026) heeft op dit moment **geen enkele gekoppelde boeking** — vandaar € 0,00.

De vier nabetalingen over 2025 bestaan wel degelijk, maar hangen nu allemaal aan **Inkomsten → Contributies 2026**:

| Datum | Tegenpartij | Bedrag | Bron |
|---|---|---|---|
| 20-01-2026 | 033 Horeca BV | € 3.000 | bankstaat + handmatige boeking + banksync |
| 08-04-2026 | Galerie Katsu B.V. | € 1.000 | bankstaat + handmatige boeking + banksync |
| 08-04-2026 | A.R. van der Ende | € 1.500 | bankstaat + handmatige boeking + banksync |
| 21-04-2026 | Happy Feelings B.V. | € 1.000 | bankstaat + handmatige boeking + banksync |

## Oorzaak

De automatische contributieherkenning in de banksync koppelt élke inkomende betaling die aan een lid en een contributiefactuur te koppelen is aan de post **Contributies**, ook als het om een factuur van een **vorig** jaar gaat. Bij elke sync worden de nabetalingen dus (opnieuw) onder Contributies gezet, waardoor Donaties en overige baten leeg blijft. Ook de handmatige boekingen met dossier "Nabetaling 2025" staan inmiddels op Contributies.

## Wat ik ga doen

1. **Herkenningsregel aanpassen**: betalingen die horen bij een contributiefactuur van een eerder jaar dan het ontvangstjaar worden gekoppeld aan **Donaties en overige baten** van het ontvangstjaar, niet aan Contributies. Reguliere contributies van het lopende jaar blijven ongewijzigd.
2. **Handmatige koppeling respecteren**: een boeking die iemand zelf aan een post heeft gehangen wordt door de sync niet meer overschreven.
3. **Bestaande gegevens corrigeren**: de vier nabetalingen (bank, banksync én handmatige boeking) terugzetten op Donaties en overige baten 2026, zodat de post weer **€ 6.500** ontvangen toont.
4. **Controleren**: na de correctie nagaan dat Contributies met exact € 6.500 daalt, dat er geen dubbeltelling ontstaat (ontdubbeling van bank/handmatig blijft werken) en dat doorklikken precies deze vier betalingen laat zien.

## Technisch

- `supabase/functions/ponto-sync/index.ts`: in `matchContributionPayments` het doel-lijnitem bepalen op basis van ontvangstjaar vs. factuurjaar; bij een ouder factuurjaar het lijnitem "Donaties en overige baten" van het ontvangstjaar kiezen. Boekingen met `matched_manually = true` blijven uitgesloten.
- Data-correctie via SQL op `ponto_transactions.budget_line_item_id`, `bank_transactions.line_item_id` en `budget_expenses.line_item_id` voor de vier genoemde regels; die worden tevens als handmatig gemarkeerd zodat de sync ze met rust laat.
- Geen schemawijziging; `useBudget.ts` en de tabellen blijven ongewijzigd.
