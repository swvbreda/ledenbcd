# Ledengegevens aanvullen vanuit het coffeeshopregister

Doel: zodra een registershop aan een lid is gekoppeld, worden ontbrekende locaties en gegevens bij dat lid automatisch aangevuld — inclusief oprichtdatum uit het KvK-handelsregister. Bestaande waarden worden nooit overschreven; afwijkingen komen in een reviewlijst.

## Wat er gebeurt

1. **Ontbrekende shops toevoegen**
   Elke bevestigde koppeling waarvan de shop nog niet als locatie bij het lid staat (match op postcode+huisnummer, anders naam+plaats), wordt als nieuwe locatie aangemaakt.

2. **Lege velden automatisch vullen** (per locatie en, waar leeg, op lidniveau)
   - adres, postcode, plaats, gemeente
   - vergunninghouder / exploitant
   - website en telefoon (alleen als het lid deze nog niet heeft)
   - oprichtdatum

3. **Conflicten ter review**
   Wijkt een bestaande waarde af van het register, dan wordt niets overschreven maar een voorstel getoond: huidige waarde, registerwaarde, en knoppen Overnemen / Negeren. Genegeerde verschillen komen niet terug.

4. **Oprichtdatum via KvK**
   De oprichtdatum (datum van inschrijving in het handelsregister) wordt opgehaald bij de KvK. Hiervoor is een **KvK API-sleutel** nodig; die vraag ik bij de bouw op. Zonder sleutel werkt de rest gewoon, maar blijft de oprichtdatum leeg.
   Matching op KvK-nummer van het lid als dat bekend is (39 leden hebben dit), anders zoeken op handelsnaam + postcode; onzekere treffers worden een reviewvoorstel in plaats van een automatische invulling.

5. **Wanneer draait het**
   Automatisch na elke registersync (dagelijks 03:20) en direct nadat je een koppeling bevestigt, plus een knop "Ledengegevens aanvullen" op de registerpagina.

## Waar je het ziet

- **Coffeeshopregister** krijgt een tabblad **Aanvullingen** met de openstaande voorstellen (per lid gegroepeerd) en een teller.
- **Ledendetailpagina**: nieuw aangemaakte locaties verschijnen in de locatielijst; het blok "Gelieerde coffeeshops (register)" toont voortaan ook welke gegevens vanuit het register zijn overgenomen.

## Technisch

- Nieuwe tabel `register_enrichment_proposals` (member_id, register_id, veld, huidige waarde, registerwaarde, bron `register`/`kvk`, status open/toegepast/genegeerd) met RLS voor admin + bestuur en GRANTs voor `authenticated`/`service_role`.
- Nieuwe edge function `enrich-members-from-register`: leest bevestigde `coffeeshop_member_links`, past fetch-and-merge toe op `members_data.data` (nooit overschrijven), schrijft conflicten als voorstellen weg en logt het resultaat.
- KvK-lookup in dezelfde function achter secret `KVK_API_KEY`, met caching van het resultaat op de registerrij (nieuwe kolommen `kvk_nummer`, `kvk_oprichtingsdatum`, `kvk_checked_at`) zodat er niet dagelijks opnieuw wordt bevraagd.
- `sync-coffeeshopregister` roept de enrichment aan het eind aan; `useCoffeeshopRegister.ts` krijgt hooks voor de voorstellen en de handmatige trigger.
- Locatievelden volgen de bestaande `Location`-structuur (`naam, plaats, stadsdeel, adres, postcode, oprichtingsDatum, kvk`).
