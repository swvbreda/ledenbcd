# Logo's volledig in beeld in het beoordeelscherm

Bij sommige logo's, zoals Strain Hunters, valt de onderkant buiten de kaart. Het logo moet altijd in zijn geheel passen binnen het vak.

## Wat ik ga doen

1. Het logo laten schalen zodat het altijd helemaal binnen het vak past, ongeacht of het breed of hoog is.
2. Wat ruimte rond het logo houden, zodat randen niet tegen de lijn aan plakken.
3. Controleren in de browser dat de tot nu toe afgekapte logo's (waaronder Strain Hunters) volledig zichtbaar zijn.

Als blijkt dat het aangeleverde logobestand zelf al afgesneden is, meld ik dat erbij; dan helpt alleen een nieuw bestand uploaden.

## Technisch

- `src/components/register/LogoGoedkeuringPanel.tsx`: de `<img>` krijgt `max-h-full max-w-full object-contain` in plaats van `h-full w-full`, met de padding op de omliggende tegel. Zo kan een globale `img { height: auto }`-regel of vergelijkbare stijl het niet meer oprekken.
- Verificatie met een ingelogde sessie op `/goedkeuringen` en een screenshot van de betreffende kaart.
