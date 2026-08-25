# Vertegenwoordigingscijfers live uit het coffeeshopregister

De kaarten op het dashboard (Vertegenwoordigde Coffeeshops, Gemeenten, Vertegenwoordiging, G4 dekking) en de pagina's Locaties en Vertegenwoordiging rekenen nu met een vast, handmatig bestand met landelijke aantallen. Het register in de app is inmiddels de actuele bron: 601 actieve coffeeshops in 107 gemeenten, met 131 bevestigde koppelingen aan 104 leden. Zodra er meer shops aan leden gekoppeld worden, moeten de percentages meebewegen.

## Wat er verandert

- **Landelijke basis uit het register**: totaal aantal coffeeshops, het aantal per gemeente en de G4-totalen komen voortaan uit het register in plaats van uit het vaste bestand. Vervallen vergunningen tellen niet mee.
- **Vertegenwoordigd = bevestigde koppelingen + eigen locaties**: elke coffeeshop die bevestigd aan een lid is gekoppeld telt mee. Locaties van leden die (nog) niet aan een registershop gekoppeld zijn, tellen ook mee, zonder dubbeltelling.
- **Gemeentedekking op registergemeente**: dekking per gemeente wordt bepaald op de gemeente uit het register (niet de vrij ingetypte plaatsnaam), waardoor plaatsen als Den Haag/Nieuw-Vennep correct meetellen.
- **Automatisch bijwerken**: na elke registersync of nieuwe bevestigde koppeling zijn de cijfers direct actueel; het dashboard ververst periodiek.
- **Ook extern gelijk**: de publieke statistieken (gebruikt door de openbare site) gaan dezelfde telling gebruiken, zodat binnen en buiten dezelfde aantallen tonen.
- Het vaste bestand blijft alleen als terugvaloptie bestaan wanneer het register onverhoopt leeg is.

## Technisch

- Nieuwe security-definer RPC `get_register_stats()` die alleen geaggregeerde cijfers teruggeeft (totaal actief, aantal per gemeente, aantal vertegenwoordigd per gemeente op basis van `coffeeshop_member_links.status = 'bevestigd'`). Nodig omdat gewone leden `coffeeshop_register` niet mogen lezen; grants alleen voor `authenticated`.
- Nieuwe hook `src/hooks/useRegisterStats.ts` met React Query (staleTime 5 min) en fallback op `src/data/coffeeshops-nl.json`.
- `StatCards.tsx`, `LocatiesPage.tsx`, `MarktaandeelPage.tsx`, `GemeenteDetailPage.tsx`, `GemeentenOverzicht.tsx`, `StedenDekkingOverzicht.tsx` en `CityMap.tsx` gaan de hook gebruiken in plaats van de directe JSON-import.
- Edge function `public-stats`: telling van coffeeshops en gemeenten aanvullen met bevestigde registerkoppelingen (uniek per registershop), zodat de publieke API hetzelfde getal geeft.
