# Lidnummers laten doorlopen zonder gaten

## Waar het nu misgaat

Er staan 116 leden in het bestand, maar de nummers lopen door tot 144. Dat komt door twee dingen:

- 17 nummers zijn leeg blijven staan doordat leden in het verleden zijn verwijderd (19, 32, 36, 58, 59, 61, 68, 81, 118, 121, 123, 124, 127, 128, 129, 130, 139).
- Een nieuw lid krijgt nu altijd "hoogste nummer + 1", ook als er lagere nummers vrij zijn. Ook leads en gestopte leden tellen mee in die berekening, dus het nummer loopt steeds verder op.

## Wat er verandert

**1. Nieuw lid krijgt het laagste vrije nummer**
Bij een nieuw lid, een goedgekeurde aanmelding, een nieuwe lead en bij het omzetten van een lead naar lid wordt voortaan het laagste nog vrije nummer gebruikt. Het eerstvolgende nieuwe lid krijgt dus 19, daarna 32, enzovoort. Pas als alle gaten gevuld zijn, gaat de teller weer verder achter het hoogste nummer.

Het nummer wordt op één centrale plek bepaald in de database, zodat twee mensen die tegelijk een lid aanmaken nooit hetzelfde nummer kunnen krijgen.

**2. Nummer van een gestopt lid komt weer vrij**
Als een lid wordt gearchiveerd, verhuist het archiefrecord naar een eigen historienummer (10001, 10002, ...). De historie, facturen en betalingen blijven volledig bewaard onder dat historienummer, en het oude lidnummer komt beschikbaar voor een nieuw lid. De 5 al gearchiveerde leden (nu 38, 40, 74, 89, 126) worden in één keer omgezet, waarmee er 22 vrije nummers ontstaan.

**3. Boekhouding loopt mee**
Verandert een nummer (bij archiveren), dan wordt het relatienummer in Informer automatisch meeveranderd, zodat lidnummer en relatienummer gelijk blijven en het nieuwe lid het vrijgekomen nummer zonder botsing kan gebruiken. Bestaande facturen blijven aan dezelfde relatie hangen.

Als Informer het wijzigen van een relatienummer niet toestaat, wordt de wijziging niet doorgedrukt: je krijgt dan in Financiën een lijstje met "dit nummer moet je in Informer nog aanpassen", zodat er nooit stilzwijgend verschil ontstaat.

**4. Zichtbaar in beheer**
In het beheerscherm komt een klein blok "Lidnummers": aantal leden, hoogste nummer, welke nummers vrij zijn en welk nummer het volgende nieuwe lid krijgt.

## Wat er niet verandert

Bestaande leden houden hun nummer. Er wordt niets hernummerd bij actieve leden, dus facturen, betalingen, koppelingen, e-mails en inloggegevens blijven ongewijzigd.

## Technisch

- Nieuwe databasefunctie `public.next_member_number()` (security definer, alleen voor ingelogde beheerders): laagste ongebruikte `id` in `members_data` onder 10000, anders `max(id)+1`; met een lock zodat gelijktijdig aanmaken geen dubbel nummer geeft.
- Nieuwe functie `public.archive_member_with_renumber(_member_id int)`: geeft het archiefrecord een nummer vanaf 10001 en werkt alle verwijzingen bij in de tabellen met `member_id` / `lid_id` / `lid_ids` (o.a. `member_contributions`, `contribution_invoices`, `contribution_payments`, `member_allowed_emails`, `member_mailing_preferences`, `member_profiles`, `member_edits`, `member_notes`, `coffeeshop_member_links`, `informer_debtor_map`, `agenda_registrations`, `whatsapp_*`, `board_members`, `finance_todos`, `beleidsmonitor_dossiers`, `register_enrichment_proposals`, `coffeeshop_register.lid_opgave_member_id`) plus `data->>'id'` in de JSON zelf. Draait als één transactie.
- `NewMemberDialog`, `GoedkeuringenPage` (aanmelding toevoegen), `useLeadConversions` en de publieke aanmeldroute halen het nummer op via `next_member_number()` in plaats van `Math.max(...ids) + 1`.
- `useArchive.archiveMember` roept de nieuwe archiveerfunctie aan.
- `informer-sync` krijgt een actie `rename_relation` (PUT `/relations/{id}` met het nieuwe `relation_number`); mislukt dat, dan komt er een regel in `finance_todos` met het handmatig door te voeren nummer.
- Eenmalige omzetting van de 5 bestaande archiefrecords via dezelfde functie, inclusief bijwerken van hun relatienummer in Informer.
