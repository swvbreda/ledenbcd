# Ledengegevens als extra registerinformatie

KvK, vergunninghouder en exploitant die een lid zelf opgeeft, komen automatisch naast de registergegevens te staan — bij aanmelding én bij latere wijzigingen. De officiële registergegevens blijven ongewijzigd; de opgave van het lid staat er los naast als extra informatie.

## Wat er gebeurt

1. Een lid wordt aangemaakt (aanmelding) of past later zijn gegevens aan.
2. Voor elke vestiging die bevestigd gekoppeld is aan een coffeeshop in het register, worden de door het lid opgegeven KvK, vergunninghouder en exploitant opgeslagen als "opgave van het lid".
3. Op de registerpagina verschijnt bij die shop een apart blokje "Opgave van het lid" met die drie gegevens en de datum van bijwerken, naast de officiële registergegevens. Wijken ze af, dan is dat direct zichtbaar; er wordt niets overschreven.
4. De dagelijkse synchronisatie met Coffeeshopbeleid stuurt de KvK, vergunninghouder en exploitant per vestiging mee, zodat die gegevens daar ook beschikbaar zijn.
5. De nachtelijke registersynchronisatie laat deze extra velden met rust — ze worden dus niet overschreven door de bron.

Bij goedgekeurde ledenwijzigingen gaat dit pas mee nadat het bestuur de wijziging heeft goedgekeurd, net als bij de andere gegevens.

## Technisch

**Database (migratie)**
- Kolommen op `coffeeshop_register`: `lid_kvk_nummer`, `lid_vergunninghouder`, `lid_exploitant`, `lid_opgave_member_id`, `lid_opgave_bijgewerkt_op`. Bewust naast de bronvelden, zodat de upsert in `sync-coffeeshopregister` (`onConflict: bron_id`, die alleen bronkolommen zet) ze niet aanraakt.
- Functie `public.apply_member_register_opgave(_member_id int)` (security definer, `search_path = public`): leest de samengevoegde ledendata (`members_data` + goedgekeurde `member_edits` via `merge_member_locations`), loopt over de bevestigde rijen in `coffeeshop_member_links` (`status = 'bevestigd'`, match op `location_key`) en schrijft per gekoppelde registerrij de KvK/vergunninghouder/exploitant van de bijbehorende vestiging weg; valt terug op de waarden op lidniveau als de vestiging ze niet heeft. Lege waarden wissen niets.
- Triggers die deze functie aanroepen: na insert/update op `members_data`, na insert/update op `member_edits`, en na insert/update van een bevestigde `coffeeshop_member_links`-rij (zodat een nieuwe koppeling de gegevens meteen ophaalt).
- Eenmalige backfill in dezelfde migratie voor alle bestaande leden.

**Frontend**
- `src/components/register/CoffeeshopRegisterDetailDialog.tsx`: blok "Opgave van het lid" met de drie velden en `lid_opgave_bijgewerkt_op`, alleen tonen als er iets is ingevuld.
- `src/hooks/useCoffeeshopRegister.ts`: de nieuwe kolommen meenemen in de select en het type.
- Ledenprofielen blijven ongewijzigd (eigendomsketen blijft register-only).

**Push naar Coffeeshopbeleid**
- `supabase/functions/beleidsmonitor-sync/index.ts`: in `buildPayload` per vestiging `vergunninghouder` en `exploitant` toevoegen (vestiging eerst, anders lidniveau) naast het bestaande `kvk_nummer`. Afwijkende veldnamen aan de ontvangende kant worden genegeerd, dus dit is veilig toe te voegen.
