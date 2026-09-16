# Eigendomsketen weg uit ledenprofielen

De eigendomsketen (de keten van bedrijven en personen achter een shop) staat nu ook op de locatiekaarten in een ledenprofiel. Die informatie hoort alleen in het register thuis.

## Wat verandert er

- In het ledenprofiel verdwijnt het blok "Eigendomsketen" bij elke vestiging.
- KvK-nummer, vestigingsnummer, vergunninghouder en exploitant blijven gewoon staan.
- Op de registerpagina (alleen bestuur/beheer) blijft de eigendomsketen ongewijzigd zichtbaar.

## Technisch

- `src/pages/MemberDetail.tsx`: `useRegisterUboBulk`-aanroep en het doorgeven van `registerUbo` aan `LocationRegisterInfo` verwijderen, zodat die gegevens niet meer worden opgehaald in het ledenprofiel.
- `src/components/register/LocationRegisterInfo.tsx`: de `registerUbo`-prop, de `ubo`-mapping en het weergaveblok verwijderen; overige secties ongemoeid laten.
- `src/components/register/CoffeeshopRegisterDetailDialog.tsx` blijft ongewijzigd.
