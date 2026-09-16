# Veld "Gemeente" weghalen bij vestigingen

## Wat je nu ziet

Bij het invullen van een lead of lid staat per vestiging zowel **Plaats** als **Gemeente**. Dat is dubbel werk: bijna overal is de gemeente gelijk aan de plaats, en het systeem kan de gemeente al zelf bepalen.

## Wat er verandert

- Het invulveld **Gemeente** verdwijnt bij elke vestiging. Je vult alleen nog **Plaats** in.
- De gemeente wordt automatisch bepaald op basis van de plaats. Voor plaatsen die onder een andere gemeente vallen (bijvoorbeeld Zaandam onder Zaanstad, Bussum onder Gooise Meren) gebeurt dat via de bestaande lijst.
- Klopt de automatische gemeente niet met de ingevulde plaats, dan zie je dat als klein grijs regeltje onder de plaats ("Gemeente: Zaanstad"), zodat duidelijk is waar de vestiging meetelt in de overzichten.
- Gemeenten die nu al bij bestaande vestigingen zijn opgeslagen blijven gewoon staan; er wordt niets gewist of overschreven.

## Wat hetzelfde blijft

Alle overzichten die op gemeente werken (vertegenwoordiging, locaties, register) blijven precies hetzelfde werken — die gebruiken deze automatische bepaling al.

## Technisch

- `src/components/MemberEditForm.tsx`: het `EditableField` voor `loc.gemeente` verwijderen; in plaats daarvan een read-only hint tonen met `getLocationGemeente(loc, plaats)` wanneer die afwijkt van `loc.plaats`.
- Opslaan blijft ongewijzigd: bestaande `gemeente`-waarden in de locatiedata worden meegenomen zoals ze zijn (geen wijziging in de merge-logica van `src/lib/memberLocations.ts` of `useMemberEdits.ts`).
- Nieuwe vestigingen krijgen `gemeente: ""` zoals nu; afleiding gebeurt bij het lezen via `getLocationGemeente`.
