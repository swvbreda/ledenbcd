## Wat er aan de hand is

De 6 taken staan wél in de database (`finance_todos`, jaar 2026, status `pending`) met `todo_type = "manual_bank_match"`. Maar in `FinancieelTodoTab.tsx` kent de UI dat type niet:

- `getTypeCategory("manual_bank_match")` valt terug op **"overig"** (onderaan de lijst)
- `typeLabels` / `typeColors` hebben geen entry → badge toont ruwe tekst `manual_bank_match` in grijs

Daardoor lijken ze "onzichtbaar" tussen de rest.

## Fix (alleen presentatie)

In `src/components/budget/FinancieelTodoTab.tsx`:

1. `typeLabels`: `manual_bank_match: "Bankboeking koppelen"`
2. `typeColors`: `manual_bank_match: "bg-purple-100 text-purple-800"` (zelfde paars als `unmatched_payment` — hoort thuis in dezelfde familie)
3. `getTypeCategory`: `manual_bank_match` → `"betaling"` zodat de 6 taken bovenaan verschijnen onder de bestaande kop **Niet-toegewezen betalingen**.

Geen data-migratie, geen backend-wijziging.
