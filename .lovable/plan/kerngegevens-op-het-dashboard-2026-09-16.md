# Kerngegevens op het dashboard

## Wat je krijgt
Onder de bestaande cijferblokken op het dashboard komt een blok
**Kerngegevens** met de belangrijkste cijfers uit de kerngegevenspagina, zodat
je ze meteen ziet zonder door te klikken:

- Aangesloten / vertegenwoordigde coffeeshops
- Vestigingen uit het ledenbestand
- Gemiddeld aantal coffeeshops per aangesloten ondernemer
- Aantal gemeenten
- Aantal vestigingen dat aan het register is gekoppeld
- Peildatum, met een link "Bekijk alle kerngegevens" naar de volledige pagina

Het blok is alleen zichtbaar voor bestuur en beheer, net als de
kerngegevenspagina zelf.

## Geen leads meer noemen
Overal in deze cijfers verdwijnt het woord "leads":

- De hint "incl. leads · zelfde telling als dashboard" op de kerngegevenspagina
  vervalt; daar komt "aangesloten coffeeshops" te staan.
- De kaart "Leden" wordt niet op het dashboard herhaald; het dashboard spreekt
  alleen over aangesloten/vertegenwoordigde coffeeshops.
- Ik loop de dashboard- en kerngegevensteksten na op andere plekken waar
  "leads" nog genoemd wordt en pas die aan.

Het getal zelf verandert niet — het blijft dezelfde telling uit het register,
zodat dashboard en kerngegevenspagina hetzelfde tonen.

## Technisch
- Nieuw `src/components/KerngegevensSummary.tsx`: gebruikt `useKerngegevens`
  en `useRegisterStats` (dezelfde bronnen als de pagina), rendert compacte
  kaarten plus link naar `/kerngegevens`; rendert niets zonder bestuursrechten.
- `src/pages/Index.tsx`: component plaatsen onder `StatCards`.
- `src/pages/KerngegevensPage.tsx`: hint-teksten aanpassen (leads eruit).
- Typecheck draaien na de wijziging.
