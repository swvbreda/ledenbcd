# Resultatenoverzicht logisch opbouwen

## Doel
Het blok **Resultaat** vervangen door één compact financieel overzicht met precies deze regels, in deze volgorde:

1. **Banksaldo 31-12-2025** — het vastgelegde beginsaldo van € 209.561,05.
2. **Contributie** — het totaal van daadwerkelijk ontvangen contributiebetalingen in het gekozen jaar.
3. **Overige inkomsten** — alle inkomende banktransacties van het jaar die niet als contributie zijn aangemerkt.
4. **Reserve (totaal)** — één samengevoegd bedrag van de reserveposten, zonder losse reserveregels in dit overzicht.
5. **Uitgaven** — alle uitgaande banktransacties van het gekozen jaar, dus het werkelijke totaal aan uitgaven en niet alleen gekoppelde begrotingsposten.

Onder deze regels komt één duidelijke eindregel: **Beschikbaar banksaldo**, berekend als beginsaldo + contributie + overige inkomsten − uitgaven. De reserve wordt informatief getoond en niet nogmaals bij het banksaldo opgeteld, omdat die reserve al onderdeel is van het banksaldo.

## Huidige oorzaak
Het huidige blok toont de technische regels uit de geïmporteerde bankstaat (**Beginsaldo**, **Bijschrijvingen**, **Afschrijvingen**, **Eindsaldo**) naast een handmatige regel **Bank saldo 31-12-2025**. Daardoor staat het beginsaldo dubbel en worden contributie, overige inkomsten en reserve niet als herkenbare onderdelen gepresenteerd.

## Uitvoering
- De resultaatberekening in de financiële pagina opsplitsen in de vijf bovenstaande bedragen.
- Contributie baseren op geregistreerde, betaalde contributiebetalingen; momenteel is dat voor 2026 € 336.500.
- Overige inkomsten afleiden uit positieve bankmutaties minus de contributiebetalingen, met bestaande uitzonderingsregels behouden.
- Uitgaven baseren op alle negatieve bankmutaties uit de live bankkoppeling, inclusief nog niet aan een dossier of begrotingspost gekoppelde betalingen en exclusief posten die bewust als **Buiten begroting (verkeerde rekening)** zijn gemarkeerd.
- Reserve optellen uit de bestaande reserveposten; momenteel is het vastgelegde totaal € 110.065,05.
- `BalancePanel` vereenvoudigen: de vreemde bankstaatregels en bestandsnaam verdwijnen uit **Resultaat**; handmatige “Post toevoegen”-regels blijven alleen waar ze nog functioneel nodig zijn.
- Controleren dat de bedragen optellen tot het actuele banksaldo en dat hetzelfde overzicht correct wisselt bij een ander jaar.

## Technisch
De bestaande beveiliging en databasegegevens blijven ongewijzigd. De aanpassing zit in de financiële aggregatie en presentatie in `FinancienPage` en `BalancePanel`; de brongegevens blijven de live bankmutaties, contributiebetalingen en bestaande balansposten.
