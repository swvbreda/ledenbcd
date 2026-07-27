## Wat er aan de hand is (geverifieerd)

De debiteuren-sync heeft op 27-07 om 09:42 **121 leden bijgewerkt** (`pull_debtors`, 121 items). Die actie schrijft de Informer-waarden rechtstreeks in het ledenbestand: bedrijfsnaam, e-mail, telefoon, KvK, adres, postcode en plaats worden overschreven zodra Informer een niet-lege waarde teruggeeft. Daardoor zie je in het ledenbestand nu de Informer-versie in plaats van jouw eigen gegevens.

Dat botst met de afspraak dat het ledenbestand leidend is en gegevens nooit zomaar overschreven worden.

## Wat ik ga bouwen

**1. Sync wordt niet-destructief**
- Informer vult alleen nog velden die in het ledenbestand **leeg** zijn.
- Bestaande waarden worden nooit overschreven; ze worden alleen als "verschil" geregistreerd.
- De factuurvelden (`factuur*`) blijven werken zoals nu: alleen invullen als ze leeg zijn.

**2. Verschillenoverzicht in de Informer-tab**
Nieuw blok "Verschillen met Informer" onder Financiën → Informer:
- Per lid een rij met veld, waarde in ledenbestand, waarde in Informer.
- Knop per veld: **Informer overnemen** (schrijft die ene waarde weg) of **Negeren** (verschil verdwijnt uit de lijst tot de waarde in Informer weer wijzigt).
- Knop "Alles overnemen voor dit lid" voor het snelle geval.
- Filter op veldtype en zoek op ledennaam.

**3. Ontbrekende/foute koppelingen zichtbaar**
- Leden zonder Informer-debiteur en debiteuren zonder lid worden apart bovenaan getoond, zodat afwijkingen door een verkeerde koppeling meteen opvallen.
- Meteen meegenomen: `pull_invoices` breekt nu volledig af op een koppeling die naar een niet-bestaand lid verwijst. Die wordt overgeslagen en gelogd in plaats van de hele run te laten falen.

**4. Over de al overschreven gegevens**
Er is geen automatische terugdraai mogelijk — de oude waarden zijn bij die run overschreven en niet apart bewaard. Waar een lid zelf gegevens heeft ingediend (`member_edits`) toon ik die als derde kolom in het verschillenoverzicht, zodat je daaruit kunt herstellen. Voor de rest kun je per veld beslissen.

## Technisch

- `supabase/functions/informer-sync/index.ts`: `mergeMemberDataFromDebtor` vult alleen lege velden; afwijkingen worden weggeschreven naar een nieuwe tabel `informer_field_diffs` (member_id, veld, waarde_lokaal, waarde_informer, status open/genegeerd/overgenomen, timestamps) met RLS voor admin/bestuur. FK-fout in `pull_invoices` wordt per rij afgevangen.
- Nieuwe component `src/components/budget/InformerVerschillenPanel.tsx`, ingehangen in `InformerSyncTab.tsx`.
- Overnemen gebeurt via fetch-and-merge op `members_data.data` (nooit de hele JSON vervangen).
