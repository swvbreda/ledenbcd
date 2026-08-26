# Accountnamen betrouwbaar aan contactpersonen koppelen

Een account krijgt de naam van de contactpersoon van wie het e-mailadres overeenkomt. Voor `chakib@theborder.nl` wordt daardoor **Chakib Tayeb** getoond in plaats van Bart van der Vlugt.

## Aanpak

- E-mailadressen aan beide kanten normaliseren: kleine letters, spaties verwijderen en samengestelde velden met komma’s, puntkomma’s of schuine strepen als afzonderlijke adressen behandelen.
- De naam in Accountbeheer bepalen via deze genormaliseerde match met:
  - de hoofdcontactpersoon;
  - de tweede contactpersoon;
  - alle items in `contacten`.
- Niet meer terugvallen op de hoofdcontactpersoon wanneer het account-e-mailadres geen contactpersoon matcht. In dat geval de eigen accountnaam tonen, of duidelijk aangeven dat er geen contactpersoon is gekoppeld.
- Bij het bewerken van een accountnaam alleen de daadwerkelijk gematchte contactpersoon aanpassen. Nooit automatisch `contactpersoon` van het hele lid overschrijven wanneer het account bij een ander item in `contacten` hoort.
- Dezelfde match gebruiken voor de contactfoto, zodat naam en foto altijd van dezelfde persoon komen.
- Een gerichte test toevoegen voor e-mailadressen met afsluitende spaties en voor meerdere adressen in één veld.

## Controle

- In Accountbeheer toont `chakib@theborder.nl` de naam **Chakib Tayeb** bij koppeling **The Border**.
- Bart van der Vlugt blijft ongewijzigd als hoofdcontactpersoon van lid 46.
- Accounts van andere leden blijven aan hun eigen contactpersoon gekoppeld, ook als e-mailvelden extra spaties of meerdere adressen bevatten.

## Technische details

- Een gedeelde e-mailnormalisatie/match-helper gebruiken in `AccountBeheerPage.tsx` in plaats van losse exacte stringvergelijkingen.
- De bestaande `member_edits` fetch-and-merge-werkwijze behouden; alleen het juiste contactobject gericht bijwerken.
- Hiervoor is geen schemawijziging nodig.
