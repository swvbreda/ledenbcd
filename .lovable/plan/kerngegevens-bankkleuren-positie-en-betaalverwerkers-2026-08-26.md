# Kerngegevens: bankkleuren, positie en betaalverwerkers

## 1. Bankiert bij — echte bankkleuren
De donut gebruikt nu rode tinten. In plaats daarvan krijgt elke bank haar eigen huisstijlkleur:

- ING oranje, Rabobank blauw, ABN AMRO groen, SNS/ASN/RegioBank eigen tinten, Knab, bunq, Triodos, Revolut, Van Lanschot, Deutsche Bank
- Onbekend blijft neutraal grijs
- Banken zonder bekende kleur krijgen een neutrale fallback uit een kleine palet-reeks

Dezelfde kleur wordt gebruikt in de donut en in de legenda ernaast (één centrale kleurfunctie, geen dubbele logica meer).

## 2. Sectie onderaan
De sectie "Bankiert bij" verhuist van boven naar het einde van de Kerngegevens-pagina, onder de bestaande secties.

## 3. Nieuwe sectie: Betaalverwerkers
Een vergelijkbare donut + klikbare legenda, gebaseerd op de enquête "Pinverwerking & Betaaldienstverlening", vraag *"Welke pin-/betaaldienstverlener gebruikt u momenteel?"*.

- Antwoorden zijn per vestiging ingevuld en kunnen meerdere aanbieders bevatten; elke aanbieder wordt geteld
- "Anders: …" antwoorden worden samengevoegd onder de genoemde naam waar mogelijk, anders onder "Anders"
- Percentages op basis van het aantal ingevulde antwoorden
- Klikken op een segment/legenda opent dezelfde detaildialog met de betrokken vestigingen/respondenten
- Aanbieders krijgen eigen kleuren (Worldline, CCV, EMS/Fiserv, Adyen, Rabobank, SumUp, YourSafe, CM.com, Mollie)
- Bronregel: aantal antwoorden uit de enquête

De sectie komt direct naast/onder "Bankiert bij" onderaan de pagina.

## Technisch
- Nieuw bestand `src/lib/brandColors.ts`: mapping banknaam en aanbieder naar kleur + fallback.
- Nieuwe hook `src/hooks/usePinverwerkers.ts`: leest `surveys` / `survey_questions` / `survey_responses` (bestuur-only, bestaande RLS) en aggregeert antwoorden per aanbieder inclusief bronvestigingen.
- `src/pages/KerngegevensPage.tsx`: donut-render naar een herbruikbaar intern `DonutSectie`-component, hergebruikt voor banken en betaalverwerkers; sectie-ordening aangepast.
