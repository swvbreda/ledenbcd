# Kernfeiten "Aanwezig in gemeenten" verifiëren met het register

## Wat er mis is

De Kernfeiten-kaart toont "36 van 104 gemeenten". Het register bevat op dit moment 566 actieve shops in **102** unieke gemeenten. Het teveel komt doordat de noemer niet alleen registergemeenten bevat: `get_representation_stats` neemt ook gemeentenamen op die alleen uit ledenlocaties komen, zonder gemeentemapping. Concreet staan deze plaatsnamen als losse "gemeente" in de lijst terwijl het geen coffeeshopgemeenten uit het register zijn:

Amstelveen, Bussum, Driebergen, Hoogezand, Mijdrecht, Steenwijk, Wormerveer

(Bussum = Gooise Meren, Driebergen = Utrechtse Heuvelrug, Hoogezand = Midden-Groningen, Mijdrecht = De Ronde Venen, Steenwijk = Steenwijkerland, Wormerveer = Zaanstad.)

Daardoor telt de kaart 104 in plaats van 102 gemeenten, en kan ook de teller (36) net verkeerd vallen omdat een ledenlocatie onder een plaatsnaam valt die niet met de registergemeente matcht.

## Wat er verandert

1. **Noemer strikt uit het register.** "Aanwezig in gemeenten" gebruikt alleen gemeenten die in het coffeeshopregister voorkomen (actieve, niet-vervallen shops). Dat is nu 102.
2. **Ledenplaatsen naar gemeente mappen.** Plaatsnamen van ledenlocaties worden eerst naar de gemeente vertaald (dezelfde mapping die de rest van de app gebruikt), zodat Bussum onder Gooise Meren valt en niet als extra gemeente meetelt. Dit gebeurt in de centrale statistiekbron zodat het dashboard, de gemeentepagina's en de kaart hetzelfde getal tonen.
3. **Teller = registergemeenten met vertegenwoordiging.** Het aantal "aanwezig" telt alleen gemeenten die zowel in het register staan als minimaal één vertegenwoordigde shop hebben; gemeenten zonder registervermelding worden apart genoemd in plaats van stilzwijgend in de noemer verwerkt.
4. **Consistentiecheck.** Na de aanpassing controleer ik dat Kernfeiten, de dashboardkaarten en de gemeentepagina alledrie hetzelfde aantal gemeenten en dezelfde vertegenwoordiging tonen.

## Technisch

- Databasemigratie op `public.get_representation_stats`: gemeentenamen uit ledenlocaties worden genormaliseerd naar de registergemeente (mapping op basis van postcode/plaats van gekoppelde registershops, met een vaste vertaaltabel voor de bekende plaats→gemeente-gevallen); rijen die niet in het register voorkomen krijgen `landelijke_shops = 0` en worden in de gemeenteteller niet meegerekend.
- `supabase/functions/public-stats/index.ts`: `aantal_gemeenten` en `landelijk_per_gemeente` alleen vullen voor rijen met `landelijke_shops > 0`.
- `src/components/LidmaatschapsduurChart.tsx`: teller/noemer uit `useRegisterStats` (`representedPerGemeente` vs `perGemeente`) in plaats van de eigen `getGemeente`-telling op `plaats`.
- Geen wijziging aan ledendata; het gaat uitsluitend om hoe er geteld en getoond wordt.
