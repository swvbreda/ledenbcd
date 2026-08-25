# Bestuursleden aanmelden + aanmeldingen wijzigen

## Wat je krijgt
1. **Bestuursleden aanmelden** voor een agenda-item, naast leden en leads.
2. **Voor leden zichtbaar wie van het bestuur aanwezig is** bij een agenda-item (namen + functie), zonder dat leden elkaars aanmeldingen zien.
3. **Aanmeldingen wijzigen** in het Deelnemers-venster (aantal personen en opmerking), niet alleen verwijderen.

## 1. Bestuursleden aanmelden
De aanmeldtabel gaat nu uit van een lidnummer. Die wordt uitgebreid zodat een aanmelding hoort bij óf een lid/lead, óf een bestuurslid:
- Nieuw veld voor het bestuurslid (verwijst naar de bestaande bestuursledenlijst).
- Het lidnummer wordt optioneel; per aanmelding moet precies één van beide ingevuld zijn.
- Toegangsregels bijgewerkt: beheerders mogen bestuursaanmeldingen toevoegen, wijzigen en verwijderen; leden blijven alleen bij hun eigen aanmelding.

In het Deelnemers-venster komt de keuzelijst uit één zoekveld met twee groepen: **Bestuur** en **Leden & leads**. Bestuursleden krijgen in de lijst een label "Bestuur".

## 2. Zichtbaar welk bestuur aanwezig is
Leden mogen aanmeldingen van anderen niet zien. Daarom komt er een beveiligde databasefunctie die per agenda-item alleen naam en functie van de aangemelde bestuursleden teruggeeft (geen lidgegevens, geen opmerkingen). Op de agendakaart komt daaronder een regel:

```text
Bestuur aanwezig: Jan (voorzitter) · Piet (penningmeester)
```

Zichtbaar voor alle ingelogde gebruikers; verborgen als er nog geen bestuursleden zijn aangemeld.

## 3. Aanmeldingen wijzigen
Per rij in het Deelnemers-venster komt naast de prullenbak een potlood-icoon. Daarmee worden aantal personen en opmerking inline bewerkbaar met Opslaan/Annuleren. De bestaande opslaglogica ondersteunt wijzigen al; er gaat bij wijzigen geen bevestigingsmail uit (zoals nu ook bij leden).

## Technische details
- Migratie op `agenda_registrations`: kolom `board_member_id uuid` (referentie naar `board_members`), `member_id` nullable, check-constraint "precies één van beide", unieke index per event voor bestuursleden, RLS-policies herschreven.
- Nieuwe security-definer functie `get_agenda_board_attendance()` → `(event_id, name, functie, guests)`, execute voor `authenticated`.
- `src/hooks/useAgenda.ts`: `AgendaRegistration` uitgebreid met `board_member_id`, `register`-mutatie accepteert een bestuurslid, nieuwe hook `useAgendaBoardAttendance()`; bevestigingsmail alleen bij leden met e-mailadres.
- `src/components/agenda/AgendaDeelnemersDialog.tsx`: gecombineerde zoeklijst (bestuur + leden), inline bewerken van rijen.
- `src/components/agenda/AgendaEventCard.tsx`: regel "Bestuur aanwezig".
