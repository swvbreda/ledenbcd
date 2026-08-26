# Jubilea per vestiging: juiste oprichtingsdatum

## Wat er mis is

The Bulldog Rockshop en The Bulldog Port staan allebei op "Opgericht 17 juni 1976". Dat is niet de datum van die vestigingen, maar de KvK-registratiedatum van het bedrijf The Bulldog B.V. (KvK 33173817). Beide vestigingen hangen onder hetzelfde KvK-nummer, dus de verrijking heeft dezelfde bedrijfsdatum bij beide locaties gezet.

Dit is op dit moment het enige geval: geen ander lid heeft twee vestigingen met dezelfde ingevulde oprichtingsdatum.

## Wat er verandert

1. **Datum per vestiging ophalen.** De verrijking vraagt voortaan het KvK-*vestigingsprofiel* op (de vestiging op dat adres) en gebruikt de aanvangsdatum van die vestiging, niet de registratiedatum van het bedrijf.
2. **Niet gokken.** Kan de vestiging niet eenduidig op adres/postcode + huisnummer worden gevonden, dan blijft de oprichtingsdatum leeg in plaats van dat de bedrijfsdatum wordt ingevuld. Beter geen datum dan een verkeerde.
3. **Bedrijfsdatum alleen waar hij klopt.** De bedrijfsdatum wordt nog wel gebruikt op ledenniveau (oprichtingsjaar van het bedrijf), maar niet meer als vestigingsdatum bij leden met meerdere vestigingen.
4. **Bestaande foute datums opruimen.** De twee Bulldog-vestigingsdatums worden gewist, zodat ze niet meer als "50 jaar" in Jubilea staan. Daarna worden ze opnieuw opgehaald via het vestigingsprofiel; lukt dat niet, dan blijven ze leeg en kun je ze handmatig invullen.
5. **Herkomst zichtbaar.** In het verrijkingsvoorstel wordt vermeld dat de datum van de KvK-vestiging komt, met vestigingsnaam/adres erbij, zodat je bij goedkeuren ziet waar het over gaat.

## Technisch

- `supabase/functions/enrich-members-from-register/index.ts`: `kvkLookup` splitsen in bedrijfsprofiel en vestigingsprofiel. Voor de vestigingsdatum eerst zoeken op `postcode` + `huisnummer` (`type=hoofdvestiging,nevenvestiging`), en alleen bij exact één resultaat het vestigingsprofiel (`datumAanvang`) gebruiken. Bedrijfsdatum (`formeleRegistratiedatum`) niet meer als `loc.oprichtingsDatum` schrijven.
- `coffeeshop_register`: naast `kvk_oprichtingsdatum` een veld voor de vestigingsdatum en het vestigingsnummer opslaan, zodat een shop niet telkens opnieuw bij de KvK wordt opgevraagd. Migratie voegt de kolommen toe; de sync/verrijking vult ze.
- Datacorrectie: `oprichtingsDatum` verwijderen uit de twee Bulldog-locaties in `members_data`/`member_edits` (alleen dat veld, de rest van de locatiegegevens blijft ongemoeid).
- `src/components/JubileumOverzicht.tsx`: geen logicawijziging nodig; de kaart valt vanzelf weg zodra de foute datums weg zijn. Wel een kleine bescherming: als meerdere vestigingen van hetzelfde lid exact dezelfde oprichtingsdatum hebben, wordt er maar één jubileumregel getoond (op lidniveau) in plaats van een dubbele.
