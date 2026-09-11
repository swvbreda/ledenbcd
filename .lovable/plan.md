# Delen blijft zonder agenda-afspraak

Bevestigd gedrag: de bevestiging met agenda-afspraak hoort alleen bij aanmelden, niet bij delen.

## Huidige situatie
- De deelpagina (`/a/CODE`) toont alleen titel, datum, tijd, locatie en een knop om in te loggen en je aan te melden.
- Er wordt bij delen geen agenda-afspraak, uitnodiging of bevestigingsmail verstuurd.
- Agenda-afspraken en bevestigingen ontstaan uitsluitend na een aanmelding.

## Wat er gebeurt
Geen codewijziging nodig. Als controle wordt eenmalig nagelopen dat het openen van een deellink geen agenda- of mailactie in gang zet, en dat een aanmelding dat wel doet.

## Technisch
- Deelroute en deelknop bevatten geen agenda- of mailaanroepen.
- Agenda- en mailacties hangen aan de aanmeldingen-tabel en de aanmeldflow.
