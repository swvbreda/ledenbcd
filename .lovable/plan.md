# Agenda-afbeeldingen passend weergeven

Liggende afbeeldingen (zoals de onderzoeksflyer) staan nu in een staand vak, waardoor er veel lege ruimte boven en onder verschijnt.

## Wat er verandert

- Het afbeeldingsvak past zich aan de afbeelding zelf aan: liggend blijft liggend, staand blijft staand.
- De hele afbeelding blijft zichtbaar, niets wordt afgesneden of vervormd.
- Een maximale hoogte voorkomt dat een heel lange poster de kaart te groot maakt.
- Geldt voor zowel de agendakaart op het dashboard als de kaart op de agendapagina.

## Technisch

- `AgendaDashboardCard.tsx` en `AgendaEventCard.tsx`: `aspect-[3/4]` verwijderen; `<img>` wordt `w-full h-auto max-h-[480px] object-contain`, zodat de natuurlijke verhouding leidend is.
- Controle met screenshot in de preview met een liggende en een staande afbeelding.
