# Locatietelling: nieuwe Greenhouse-locaties komen niet in het totaal

## Wat ik heb gecontroleerd

- Het totaal van 159 klopt exact met de opgeslagen data: de som van alle ledenlocaties is op dit moment 159 (137 via registerkoppeling + 22 losse locaties).
- Greenhouse (lid #5) heeft in de database nog steeds **5 locaties**: Centrum, Namaste, Tolstraat, United, Strain Hunters. De net toegevoegde locaties staan er niet bij.
- Er staat geen openstaand wijzigingsverzoek voor Greenhouse, en het wijzigingsrecord van Greenhouse is niet recent bijgewerkt (laatste wijziging in het hele bestand is van 24 augustus, Bronx).

Conclusie: de telling telt goed, maar **de toegevoegde locaties zijn niet opgeslagen**. Er zijn twee mechanismen die dit veroorzaken, allebei stil (zonder melding):

1. Een locatierij zonder adres én zonder plaats wordt bij het opslaan weggefilterd. Vul je alleen de naam van de shop in, dan verdwijnt de rij zonder waarschuwing — zowel in de app als in de landelijke telling.
2. Ook als de opslag wél lukt, verandert het getal niet meteen: de statistieken komen uit een functie die 5 minuten gecached wordt en na het opslaan niet ververst wordt.

## Wat ik ga bouwen

### 1. Geen stille verdwijning meer
- Bij opslaan wordt gecontroleerd of er locatierijen zijn zonder adres en zonder plaats. In plaats van ze weg te gooien, krijg je een duidelijke melding: "Locatie 'X' is niet opgeslagen — vul minimaal adres of plaats in."
- Rijen die alleen een naam hebben blijven in het formulier staan met een rode markering, zodat je ze kunt aanvullen in plaats van opnieuw te typen.
- Na opslaan een bevestiging met het aantal opgeslagen locaties ("6 locaties opgeslagen").

### 2. Tellingen direct verversen
- Na het opslaan van een lid worden ook de statistiek-queries ververst (ledenbestand, vertegenwoordiging, register), zodat het dashboard meteen het nieuwe aantal toont.
- Op het dashboard komt een kleine "bijgewerkt om HH:MM"-vermelding met verversknop, zodat duidelijk is of je naar verse cijfers kijkt.

### 3. Controle op Greenhouse
- Na de fix voer ik de toevoeging opnieuw uit/controleer ik of de ontbrekende Greenhouse-vestigingen (o.a. Greenhouse Lounge, dat wel als registershop gekoppeld is maar geen eigen locatierij heeft) correct als locatie in het ledenbestand staan, zodat register en ledenbestand op elkaar aansluiten.

## Technische details

- `cleanLocaties` in `src/hooks/useMemberEdits.ts` filtert locaties zonder `adres` en `plaats`; dezelfde regel zit in `public.get_representation_stats()`. De filter blijft (om lege rijen buiten de telling te houden) maar wordt zichtbaar gemaakt in `MemberEditForm`/opslaanpad in plaats van stil.
- `useSaveMemberEdit.onSuccess` invalideert nu alleen `["member-edits"]`; uitbreiden met `["members-data"]`, `["register-plaats-stats"]` en `["register-links"]`.
- `useRegisterStats` heeft `staleTime` 5 min en de `public-stats` edge function stuurt `Cache-Control: max-age=300`. Voor de handmatige verversknop wordt een cache-bust-parameter meegestuurd.
- Geen databasewijziging nodig: de RPC-logica telt correct (elke locatie precies één keer, registerkoppelingen zonder eigen locatierij worden niet dubbel geteld).
