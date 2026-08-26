# Herstel nabetalingen 2025 bij Donaties en overige baten

## Vastgestelde oorzaak
- In de database staan drie inkomende nabetalingen uit 2025, ontvangen in 2026, correct gekoppeld aan **Donaties en overige baten**: Katsu € 1.000, A.R. van der Ende € 1.500 en Happy Feelings € 1.000 — samen **€ 3.500**.
- De budgetquery leest voor gekoppelde bankboekingen momenteel alleen de live banktabel. Deze drie boekingen staan in de administratieve banktabel en ontbreken in de live banktabel, waardoor de tabel ten onrechte € 0 toont.

## Aanpak
1. Laat de budgetquery gekoppelde inkomsten en uitgaven uit beide bankbronnen meenemen.
2. Behoud de bestaande ontdubbeling op bedrag, richting, factuurkenmerk, tegenpartij en datum, zodat een boeking die later ook via de live bankkoppeling binnenkomt niet dubbel wordt geteld.
3. Laat nabetalingen uit een vorig contributiejaar bij het ontvangstjaar onder **Donaties en overige baten** staan; reguliere contributies van het lopende jaar blijven onder **Contributies**.
4. Controleer in het financiële dashboard dat **Donaties en overige baten** voor 2026 weer € 3.500 ontvangen toont en dat doorklikken precies de drie onderliggende betalingen laat zien.

## Technisch
- Aanpassing blijft beperkt tot de financiële data-opbouw in `useBudget`.
- Er worden geen factuurgegevens, transacties of bestaande koppelingen gewijzigd.
