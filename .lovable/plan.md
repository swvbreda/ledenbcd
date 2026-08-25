# Agenda-item kaart: afbeelding rechts, tekst ernaast, aanmeldknop terug

## Wat er verandert

**1. Indeling: poster rechts, tekst links ernaast**
- De kaart krijgt twee kolommen: links titel, badges, datum/tijd/locatie/aanmeldingen, "Bestuur aanwezig" en de volledige omschrijving; rechts de poster.
- De poster staat bovenaan uitgelijnd met de titel, met vaste breedte (ca. 260 px) en volledige hoogte zichtbaar (`object-contain`, geen afkapping) — dus de tekst in de poster blijft leesbaar. Klikken opent de poster nog steeds op volledig formaat in een nieuw tabblad.
- Op mobiel stapelt het: poster boven de tekst, volledige breedte.

**2. Aanmeldknop weer zichtbaar**
- Nu verschijnt "Aanmelden" alleen als het ingelogde account aan een lid gekoppeld is. In het huidige beeld (beheerdersaccount zonder lidkoppeling) ontbreekt de knop daarom.
- Nieuw: bij komende items staat er altijd een duidelijke primaire knop rechtsboven in de kaart:
  - lid gekoppeld → "Aanmelden" (of "Wijzigen (x pers.)" + "Afmelden" als er al een aanmelding is);
  - beheerder zonder lidkoppeling → "Aanmelden" die het Deelnemers-venster opent, waar bestuursleden en leden aangemeld kunnen worden;
  - volgeboekt → knop uitgeschakeld met "Volgeboekt".
- Beheerdersacties (Deelnemers, wijzigen, verwijderen) blijven staan, maar in een aparte rij onderaan de kaart zodat de aanmeldknop niet meer wegvalt tussen de icoontjes.

## Technisch

- Alleen `src/components/agenda/AgendaEventCard.tsx` wordt aangepast; geen datawijzigingen.
- Layout via een `flex` rij (`md:flex-row`) met tekstkolom `flex-1 min-w-0` en poster als `md:w-64 shrink-0`.
- Bestaande tokens (`primary`, `brand-red`, `border`, `muted-foreground`) blijven gebruikt.
