# Hinttekst uit de budgettabel halen

De regel "116 facturen verstuurd (+8 t.o.v. begroting) · totaal gefactureerd € 338.500" onder de post Contributies verdwijnt uit de tabel.

## Wijziging
- In `src/pages/FinancienPage.tsx`: de berekening van `hint` (en de doorgifte via `remainingHint`) bij de post "Contributies" verwijderen.
- De klikbare bedragen (Begroot / Ontvangen / Openstaand) en het label "openstaand" blijven ongewijzigd werken.
- Ongebruikt geworden variabelen (`invoicedTotal`, `budgetedMembers`, `extra`) opruimen.

De gedetailleerde factuuraantallen blijven zichtbaar in het breakdown-dialoog dat opent bij het klikken op een bedrag.
