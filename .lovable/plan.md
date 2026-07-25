## Situatie

- Dr Pleasure (#131) heeft factuur **2026-0002** open (€1.500).
- De betaling van Riemer BV zit **nog niet** in `ponto_transactions` — de laatste inkomende boeking dateert van 22 juli. Ponto is dus nog niet gesynced sinds die overboeking, of Ponto heeft hem nog niet aangeleverd.
- Ter vergelijking: Flamingo (2026-0001) en L-J-N (2026-0004) betaalden ook met een afwijkende bedrijfsnaam en zijn nu **handmatig** gekoppeld — de auto-match had die op basis van het factuurnummer in de omschrijving ook moeten pakken, maar dat gebeurt pas als de boeking via Ponto binnenkomt.

## Aanpak

1. **Ponto-sync forceren** (`trigger_informer_sync` equivalent voor Ponto, of de bestaande knop op de Financiën-pagina) zodat de Riemer-boeking wordt opgehaald. Daarna direct `matchContributionPayments` draaien.
2. **Verifiëren wat er in de omschrijving staat.** Zodra de boeking binnen is, kijken of `2026-0002` letterlijk voorkomt. Zo ja → stap-1-match in `ponto-sync/index.ts` (regel 343-356) pakt hem automatisch en koppelt aan #131, ongeacht dat de tegenpartij "Riemer BV" heet.
3. **Als het factuurnummer niet in de omschrijving staat**, valt de match terug op naam/IBAN, wat hier niet werkt. In dat geval:
   - Boeking handmatig koppelen aan #131 via het bestaande "Openen"-dialoog in de bankboekingenlijst.
   - Nieuwe IBAN van Riemer BV opslaan onder `members_data.data.ibans` van #131 zodat toekomstige betalingen automatisch matchen via de bestaande IBAN-strategie (stap 3 in `matchContributionPayments`).
4. **Kleine verbetering in matching** (`supabase/functions/ponto-sync/index.ts`): loggen wanneer een factuurnummer wél in de omschrijving voorkomt maar het bedrag afwijkt (nu wordt zo'n rij stil overgeslagen), zodat we in de sync-log direct zien waarom een auto-match faalde.

## Vragen

Voor ik dit uitvoer: mag ik nu de Ponto-sync triggeren om te kijken of de Riemer-boeking al opvraagbaar is, of heb je zelf de bankomschrijving bij de hand die ik kan gebruiken om te bepalen of het factuurnummer erin staat?
