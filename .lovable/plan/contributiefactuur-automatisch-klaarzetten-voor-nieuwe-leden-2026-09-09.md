# Contributiefactuur automatisch klaarzetten voor nieuwe leden

## Wat er nu gebeurt

Bij een nieuw lid wordt alleen een taak aangemaakt ("Factuur aanmaken voor nieuw lid #..").
Er wordt niets in de boekhouding klaargezet. Controle in de gegevens: lid 141 (Coffeeshop Relax)
en lid 140 hebben wel de taak, maar geen contributie en geen factuur voor 2026.
De koppeling met de boekhouding haalt op dit moment alleen gegevens óp (debiteuren en facturen);
er wordt niets naar de boekhouding weggeschreven.

## Wat we bouwen

1. **Bedrag naar rato.** Bij een nieuw lid wordt het jaarbedrag (€3.000) omgerekend naar het aantal
   resterende maanden vanaf de maand van aanmelding. Voorbeeld: instap in september = 4/12 = €1.000.
2. **Debiteur controleren/aanmaken.** Heeft het lid nog geen debiteur in de boekhouding, dan wordt die
   eerst aangemaakt op basis van de factuurgegevens (bedrijfsnaam, KvK, adres, e-mail) en gekoppeld.
3. **Factuur klaarzetten als concept.** Er wordt een verkoopfactuur als concept klaargezet met regel
   "Contributie <jaar> (vanaf <maand>)" en het berekende bedrag. Versturen blijft handwerk in de
   boekhouding, zodat er nooit ongewild een factuur de deur uit gaat.
4. **Automatisch bij een nieuw lid.** Zodra een lid wordt aangemaakt (via aanmelding, handmatig of
   omzetten van een lead) wordt de concept-factuur klaargezet en de taak afgevinkt zodra dat gelukt is.
   Mislukt het, dan blijft de taak staan met de foutmelding erbij.
5. **Bestaande achterstand wegwerken.** Op de financiënpagina komt een knop
   "Ontbrekende facturen klaarzetten" die alle leden zonder factuur voor het lopende jaar in één keer
   afhandelt, met een overzicht vooraf (lid, bedrag, maand) en bevestiging.
6. **Terugkoppeling.** De bestaande ophaalsynchronisatie zet de aangemaakte factuur daarna in het
   portaal (factuurnummer, datum, bedrag), zodat "Nog geen factuur verstuurd" verdwijnt.

## Eerst controleren

De boekhoudkoppeling is nu alleen-lezen. Als allereerste stap testen we of het account schrijfrechten
heeft voor het aanmaken van relaties en verkoopfacturen. Lukt dat niet, dan melden we dat terug en
zetten we in plaats daarvan de factuurregel alleen in het portaal klaar, met de taak als herinnering.

## Technisch

- `supabase/functions/informer-sync/index.ts`: nieuwe acties `create_debtor` en `create_sales_invoice`
  (POST `/relations` en `/invoices/sales`, concept/draft), hergebruik van bestaande headers, retries en
  `informer_sync_log`. Regels worden gelogd inclusief request/response voor foutopsporing.
- Pro-rata helper (jaarbedrag uit `budget_year_settings`/vaste €3.000, maanden vanaf `lidSinds`/aanmaakdatum),
  gedeeld tussen automatische en bulk-actie; unit test op de berekening.
- Automatische trigger: databasetrigger op `members_data` (naast `auto_todo_new_member`) roept via `pg_net`
  de functie aan met `member_id`; idempotent op `(member_id, year)` in `contribution_invoices`/`member_contributions`,
  zodat dubbele facturen uitgesloten zijn.
- `member_contributions` krijgt bij aanmaak het pro-rata bedrag met `paid=false`.
- Frontend: knop + voorbeeldoverzicht in de contributie/financiënsectie; taakkaart toont fout wanneer
  het klaarzetten mislukt.
