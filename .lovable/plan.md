# Onderzoek: "alle deelnemers van één evenement mailen"

Alleen-lezen onderzoek. Niets gewijzigd, niets verstuurd, niets gepubliceerd.

## Conclusie
Er is geen bewijs dat deze knop ooit heeft bestaan. Het lijkt dus geen regressie. In de volledige geschiedenis (5.897 wijzigingen) komt geen knop of tekst voor als "Mail deelnemers", "Deelnemers mailen", "Mail naar deelnemers" of "Kopieer e-mailadressen" bij de agenda. De enige treffer op "Alle deelnemers" komt uit de Community-takenlijst ("Alle deelnemers zijn gekoppeld"). Die heeft niets met evenementen te maken.

Wat waarschijnlijk wordt bedoeld, is een van deze drie bestaande opties. Ze staan nog allemaal op hun plek:

1. **Aankondiging versturen** (sinds 3 september 2026). Deze mailt leden en leads, **niet** de aangemelde deelnemers.
   Klikpad: Agenda → evenementkaart → onderste balk (alleen voor beheerders) → "Aankondiging versturen".
   De knop is alleen zichtbaar als het item het type Evenement heeft **en** nog in de toekomst ligt. Bij een afgelopen evenement of een bestuursvergadering verdwijnt de knop. Dit werkt zo bedoeld en is geen fout.
2. **Evenement annuleren**, met het vinkje "Aangemelde deelnemers per e-mail informeren". Dit is de enige plek die echt alle aangemelden tegelijk mailt, maar alleen bij annuleren.
3. **Mailing-export (Outlook BCC)** in het ledenoverzicht. Die werkt op leden, niet op de deelnemers van één evenement.

In het venster "Deelnemers" op de evenementkaart staat per aanmelding alleen een bevestiging of "Weigeren en mailen". Er is geen knop om iedereen tegelijk te mailen.

## Bewijs (bestanden)
- `src/components/agenda/AgendaEventCard.tsx` r. 258–268: de beheerbalk. De voorwaarde `isAdmin` + `isEvent && upcoming` bepaalt of "Aankondiging versturen" zichtbaar is.
- `src/components/agenda/AgendaAnnounceDialog.tsx` r. 117–138: de ontvangers zijn leden en leads uit het ledenbestand, niet de aanmeldingen. Toegevoegd in wijzigingen e3228d63, b5fb465f en 25153acd (3 september 2026).
- `src/components/agenda/AgendaCancelDialog.tsx` r. 92: het vinkje om aangemelden te mailen bij annuleren.
- `src/components/agenda/AgendaDeelnemersDialog.tsx`: alleen mailacties per persoon, geen verzending naar iedereen.
- `src/components/MailingExportButton.tsx`: Outlook-BCC-export voor leden (wijziging 15ae9e43, juni 2026).

## Voorstel (aparte taak, alleen na akkoord)
Een knop "Mail alle deelnemers" toevoegen in het venster Deelnemers (alleen voor beheerders). Daarbij:
- ontvangers zijn alleen de aangemelde deelnemers en gasten van dit evenement, elk adres één keer;
- je ziet eerst hoeveel adressen het zijn en typt zelf onderwerp en tekst;
- er wordt pas iets verstuurd als je op Versturen klikt;
- de bestaande verzendfunctie slaat afgemelde adressen over en elke mail wordt maar één keer verstuurd (idempotency key per evenement en adres);
- geen testmails, en publiceren alleen na jouw akkoord.

Vraag: bedoelt de gebruiker misschien optie 1 of 2 hierboven? Zo niet, dan kan ik dit voorstel bouwen.
