# Afgeknipte logo's oplossen

## Wat er aan de hand is

Het beoordeelscherm knipt niets af: het opgeslagen logobestand van Strain Hunters is zelf al een uitsnede. Het bewaarde bestand is 300 x 300 en toont alleen het middelste stuk van het blad; de rest zit er niet in. Zo'n bestand kan nooit heel worden getoond, ook niet op de logowand van coffeeshopbond.nl.

Oorzaak: bij het automatisch ophalen van logo's van websites wordt soms een vierkant website-icoontje (apple-touch-icon/favicon) gepakt in plaats van het echte, brede logo. Die icoontjes zijn vaak bijgesneden.

## Wat ik ga doen

1. Slimmer ophalen: bij het automatisch ophalen krijgt een echt logobestand voorrang; vierkante website-icoontjes worden alleen nog gebruikt als er niets beters is. Ook wordt een gevonden logo van een groter formaat geprefereerd.
2. Overzicht van verdachte logo's: in het goedkeuringsscherm markeer ik logo's die vrijwel zeker een uitsnede zijn (vierkant, klein, beeld raakt de rand) met het label "mogelijk bijgesneden", zodat je ze er zo uit pikt.
3. Opnieuw ophalen per logo: naast Goedkeuren / Afkeuren / Uploaden komt een knop "Opnieuw ophalen", die het logo nogmaals van de website van die coffeeshop haalt met de verbeterde keuze.
4. Strain Hunters: het huidige bijgesneden bestand wordt verwijderd en opnieuw opgehaald; lukt dat niet, dan blijft de tegel leeg tot je zelf een bestand uploadt.

## Technisch

- `src/routes/api/public/register-enrich.ts`: logo-keuze aanpassen (echte `<img>`-logo's en `og:logo` voorrang boven `apple-touch-icon`/favicon; afmetingen controleren na download, vierkante bestanden <= 300 px als laatste keus).
- Nieuwe serverfunctie `refetchShopLogo` in `src/lib/shopLogo.functions.ts` (`requireSupabaseAuth` + `assertBeheer`), die voor een register-id het logo opnieuw ophaalt en in bucket `shop-logos` opslaat.
- `src/components/register/LogoGoedkeuringPanel.tsx`: knop "Opnieuw ophalen" per kaart plus een badge "mogelijk bijgesneden" op basis van de afmetingen van de geladen afbeelding (`naturalWidth/Height` en randdetectie via beeldverhouding).
- Geen wijziging aan de publieke lijst (`leden-logos.ts`) of aan de opslagregels.
