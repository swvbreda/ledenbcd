# Eigendomsketen alleen voor bestuur, KvK-nummers blijven

Op het scherm is de eigendomsketen al afgeschermd: alleen bestuur en beheer zien dat blok. Er is wel een stil lek: bij 109 leden is de eigendomsketen mee opgeslagen in de ledengegevens zelf. Een lid dat zijn eigen profiel opent, haalt die gegevens onzichtbaar mee binnen en kan ze uitlezen. Dat wordt dichtgezet.

## Wat er verandert

1. **Eigendomsketen niet meer bij het lid opslaan**
   De automatische aanvulling vanuit het register schrijft de eigenaarsketen niet langer weg in de ledengegevens. Die informatie blijft alleen in het register staan, dat uitsluitend voor bestuur en beheer leesbaar is.

2. **Bestaande opgeslagen ketens opruimen**
   Bij de 109 leden waar de keten al is meegeschreven, wordt dat veld verwijderd. Alle overige gegevens blijven ongewijzigd.

3. **Bestuur ziet hetzelfde als nu**
   Op de locatiekaarten blijft de eigendomsketen zichtbaar voor bestuur en beheer; die wordt voortaan rechtstreeks uit het register gehaald.

4. **KvK-nummers blijven wél gevuld**
   KvK-nummer, vestigingsnummer, vergunninghouder en exploitant blijven per locatie ingevuld en zichtbaar zoals nu.

## Technisch

- `supabase/functions/enrich-members-from-register/index.ts`: de regels die `loc.ubo` zetten (rond 444 en 452) vervallen; de rest van de verrijking (adres, KvK, vergunninghouder, exploitant, vestigingsnummer) blijft ongewijzigd. Functie opnieuw deployen.
- Data-opschoning via `run_sql`: `ubo` uit elk locatie-object in `members_data.data->'locaties'` verwijderen, ook op lidniveau als het daar voorkomt.
- `src/pages/MemberDetail.tsx`: `memberUbo={loc.ubo}` vervalt, zodat de keten uit `registerUbo` komt (alleen geladen als `canSeeRegister`).
- `src/components/register/LocationRegisterInfo.tsx`: prop `memberUbo` verwijderen; overige velden ongemoeid.
- `src/data/types.ts`: `ubo` op `Location` markeren als niet meer gebruikt/verwijderen, afhankelijk van resterende verwijzingen.
- Geen schema- of RLS-wijziging nodig: `coffeeshop_register_ubo` is al alleen leesbaar voor admin/bestuur.
