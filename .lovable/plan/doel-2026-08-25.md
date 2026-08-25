Coffeeshopregister als los menu-item onder Ledenbestand

## Doel
Het Coffeeshopregister staat momenteel als uitklapbaar sub-item onder "Ledenbestand". De gebruiker wil het terug als los menu-item, liefst onder "Ledenbestand" in de zijbalk, en nog steeds alleen zichtbaar voor bestuur/admins.

## Wijzigingen
1. In `src/components/AppSidebar.tsx`:
   - De huidige submenu onder "Ledenbestand" (met items "Leden" en "Coffeeshopregister") verwijderen.
   - "Ledenbestand" weer een normaal, niet-uitklapbaar menu-item maken.
   - Een nieuw los menu-item "Coffeeshopregister" toevoegen in dezelfde "Navigatie"-groep, direct onder "Ledenbestand".
   - Dit item alleen tonen als `isAdmin || isBoard`.
2. Het eventuele oude "Coffeeshopregister"-item in de "Community"-groep blijft verwijderd (dat was een eerdere tussenstap).

## Resultaat
Zijbalk-navigatie wordt (voor bestuur/admins):
- Overzicht
- Ledenbestand
- Coffeeshopregister
- Gemeenten
- Agenda
- Enquêtes
- Ledenvoordelen
- Jaarplan
- (admin-only items)

## Technisch
- Bestand: `src/components/AppSidebar.tsx`
- Geen database-, backend- of route-wijzigingen nodig.
