# Deelnemers: namen toevoegen + venster opnieuw vormgeven

## Wat er nu misgaat
- In het Deelnemers-venster kun je alleen een lid en een aantal personen kiezen; er is geen veld voor de naam van de persoon die daadwerkelijk komt.
- De indeling van het venster loopt uit het kader: velden en de knop "Aanmelden" staan te breed naast elkaar en de blokken hebben te weinig onderscheid.

## Wat ik ga bouwen

### 1. Namen per aanmelding
- Bij een aanmelding kun je per persoon een naam invullen: bij "2 personen" verschijnen twee naamvelden.
- Namen zijn optioneel; laat je ze leeg, dan blijft de aanmelding zoals nu (naam van lid of bestuurslid).
- Namen zijn zichtbaar in de deelnemerslijst onder de lidnaam en zijn te wijzigen via het potlood-icoon, samen met aantal personen en opmerking.
- Namen gaan ook mee in de bevestigingsmail en in de deelnemerslijst per evenement.

### 2. Nieuw ontwerp van het venster
- Ik maak drie ontwerprichtingen voor het Deelnemers-venster (zelfde huisstijl: wit, rood accent, Archivo Black koppen) en laat die zien zodat je er één kiest.
- Vaste verbeterpunten in elke richting: duidelijk gescheiden blok "Deelnemerslijst" en blok "Aanmelden", velden onder elkaar op smalle schermen, aantal-personen als compacte stepper, en de aanmeldknop op volle breedte binnen het kader.

## Technisch
- Migratie: kolom `attendee_names text[]` op `agenda_registrations` (nullable, default `'{}'`).
- `src/hooks/useAgenda.ts`: `AgendaRegistration` type en de `register`-mutatie uitbreiden met `attendee_names`; namen meesturen naar de bevestigingsmail-template.
- `src/components/agenda/AgendaDeelnemersDialog.tsx`: dynamische naamvelden (gekoppeld aan het aantal personen), namen in de lijst en in de inline-bewerkmodus, plus de gekozen ontwerprichting.
- `src/components/agenda/AgendaEventCard.tsx`: geen functionele wijziging, alleen consistente weergave van aantallen.
