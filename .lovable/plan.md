Verbeter uitlijning agenda-afbeelding

## Doel
De evenementenafbeelding op de agenda-pagina moet netter rechts naast de tekst staan, in plaats van boven/onder de tekst in de linkerkolom.

## Aanpak
- Pas `src/components/agenda/AgendaEventCard.tsx` aan:
  - Plaats de tekst (titel, meta, omschrijving) in een linkerkolom.
  - Plaats de afbeelding in een rechterkolom binnen de bestaande kaart-layout.
  - Behoud responsiviteit: op smalle schermen stapelen tekst en afbeelding onder elkaar (bijv. afbeelding boven of onder de tekst).
  - Zorg dat de actieknoppen (Aanmelden, Deelnemers, bewerken/verwijderen) op hun plaats blijven.
  - Houd toegankelijkheid (alt-tekst) en click-to-view gedrag in stand.

## Niet in scope
- Dashboard-kaart (`AgendaDashboardCard`) heeft al een compacte duimnagel-links layout; die blijft zo.
- Functionaliteit van aanmelden/bewerken/verwijderen wijzigt niet.

## Bestanden
- `src/components/agenda/AgendaEventCard.tsx`
