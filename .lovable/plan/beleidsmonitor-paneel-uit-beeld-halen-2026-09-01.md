# Beleidsmonitor-paneel uit beeld halen

Het blok "Koppeling Beleidsmonitor" op de Coffeeshopregister-pagina verdwijnt uit de interface. De koppeling zelf blijft gewoon draaien.

## Wat er verandert
- Het paneel wordt niet meer getoond op `/coffeeshopregister`.
- De dagelijkse automatische synchronisatie (04:30) blijft ongewijzigd actief.
- Ophalen en opslaan van dossiers blijft werken; alleen de weergave en de handmatige knop verdwijnen.

## Technisch
- `src/pages/CoffeeshopRegisterPage.tsx`: import en gebruik van `BeleidsmonitorSyncPanel` verwijderen (regels 26 en 199).
- `src/components/register/BeleidsmonitorSyncPanel.tsx`: bestand verwijderen.
- Edge function `beleidsmonitor-sync`, de cron-job en de tabellen blijven ongewijzigd.
