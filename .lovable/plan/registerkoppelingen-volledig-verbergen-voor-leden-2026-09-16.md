# Registerkoppelingen volledig verbergen voor leden

## Wat er nu misgaat
De koppelingen zelf zijn in de database al afgeschermd: alleen bestuur en
beheer kunnen het register, de koppelingen, de eigendomsketen en de
koppelvoorstellen ophalen. In de schermen lekt er toch nog informatie over
koppelingen naar gewone leden:

1. Op de pagina **Gemeenten** staat bovenaan het blok "Aansluiting op het
   register" met de tekst "… locaties · … gekoppeld · … te koppelen". Dat blok
   wordt ook aan leden getoond (alleen de knop "Controleren" is verborgen).
2. Op **Gemeente-detail** en **Vertegenwoordiging** staan links/knoppen
   "Bekijk registerdetails" en "register" die iedereen ziet, terwijl de
   registerpagina zelf alleen voor bestuur is (een lid krijgt daar een
   melding dat het niet mag).

## Wat ik ga doen
- Het blok "Aansluiting op het register" verdwijnt volledig voor iedereen die
  geen bestuur of beheer is — geen aantallen, geen tekst, geen knop.
- De doorklikmogelijkheden naar het register op de gemeente- en
  vertegenwoordigingspagina worden alleen nog voor bestuur en beheer getoond.
- Ik loop daarna alle overige ledenschermen na (dashboard, kerngegevens,
  statistieken, ledenprofiel inclusief het eigen profiel, gemeente-overzichten)
  en controleer dat er nergens nog iets over koppelen, gekoppeld,
  registerkoppeling of verificatie zichtbaar is voor een lid.

Wat leden wél blijven zien, blijft ongewijzigd: hun eigen gegevens zoals
KvK-nummer, website en vestigingsinformatie, en de algemene cijfers over
aangesloten coffeeshops.

## Technisch
- `src/components/register/RegisterCoverageCard.tsx`: vroege `return null`
  wanneer `!allowed` (bestuur/beheer), zodat ook de kop en tellingen weg zijn.
- `src/pages/GemeenteDetailPage.tsx` en `src/pages/MarktaandeelPage.tsx`:
  registerdoorkliks achter `isAdmin || isBoard` uit `useAuth()`.
- Controlepass met een zoekopdracht op register-/koppelteksten in alle
  ledenzichtbare componenten; eventuele resterende plekken op dezelfde manier
  afschermen.
- Afsluiten met een typecheck en een korte controle in de browser als
  ingelogd lid zonder bestuursrol.
