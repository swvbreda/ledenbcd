# Poster in agendakaart correct weergeven

De poster van "Open dag Tweede kamer" wordt in de dashboardkaart uitgerekt/bijgesneden weergegeven: alleen een smalle strook van de staande flyer is zichtbaar en de rest valt buiten beeld.

## Oorzaak

In `AgendaDashboardCard.tsx` staat de afbeelding in een flexkolom met `md:h-full` en `object-cover`. De kolomhoogte wordt bepaald door de tekst ernaast, waardoor de staande poster (portret) hard wordt bijgesneden en ingezoomd.

## Wat er verandert

- De poster krijgt een vaste, natuurlijke verhouding (staand, 3:4) in plaats van "vullen tot kaarthoogte".
- De hele flyer blijft zichtbaar (`object-contain` op een neutrale achtergrond) zodat er niets meer wordt afgesneden of vervormd.
- Mobiel: poster boven de tekst, volledige breedte met dezelfde verhouding.
- Dezelfde behandeling in de agendapagina-kaart (`AgendaEventCard.tsx`) zodat beide weergaves gelijk zijn.
- Overige opmaak (rode rand, badge, knop Aanmelden) blijft ongewijzigd.
