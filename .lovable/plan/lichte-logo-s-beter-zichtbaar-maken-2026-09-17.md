# Lichte logo's beter zichtbaar maken

Sommige logo's zijn wit of heel licht met een doorzichtige achtergrond. Op de witte kaart zijn ze daardoor nauwelijks te zien, zoals bij De Steeg en Empire.

## Wat ik ga doen

1. Elk logo krijgt een lichtgrijs ruitjespatroon als ondergrond, zodat je meteen ziet waar het logo ophoudt en of het doorzichtig is.
2. Boven het overzicht komt een knop "Donkere achtergrond". Daarmee zet je alle logo's in één klik op een donkere ondergrond, zodat witte logo's goed zichtbaar worden om te beoordelen.
3. Op elke kaart komt een klein knopje om alleen dat ene logo donker te bekijken, handig als je twijfelt bij één shop.
4. De logo's worden iets groter weergegeven zodat details beter te beoordelen zijn.

Dit verandert alleen hoe je de logo's ziet in het beoordeelscherm; de logo's zelf en wat er op coffeeshopbond.nl komt blijven ongewijzigd.

## Technisch

- `src/components/register/LogoGoedkeuringPanel.tsx`: preview-tegel krijgt een schaakbordachtergrond via een CSS-gradient-utility, hoogte van `h-28` naar ca. `h-36`, plus state `donkereAchtergrond` (globaal) en een per-kaart override die de tegel op een donkere kleur zet.
- Geen wijzigingen in serverfuncties, database of de publieke logo-endpoints.
