# Dubbele vestigingen: duidelijker en minder streng

Mijn vorige overzicht noemde alles met hetzelfde adres "dubbel". Dat klopt niet: twee leden kunnen prima op hetzelfde adres zitten, en een vestiging kan zijn overgenomen en hernoemd. Het overzicht wordt daarom omgebouwd van "fouten" naar "controleren", met per geval een duidelijke uitleg en keuze.

## Wat er nu echt staat

- **Hetzelfde adres bij twee leden** (1 geval): 1e Oosterparkstraat 47, Amsterdam — The Plug East (lid 51) en The Plug (Utopia) (lid 66). Een instelling "gelieerd" bestaat nog niet in het systeem; die wordt nu gemaakt.
- **Hetzelfde adres binnen één lid** (5 gevallen): Hunters (Utrechtsestraat 14, 3x), Coffeshop Paradox (1e Bloemdwarsstraat 2, 2x), Boerejongens (Humberweg 2: "Boerejongens Sloterdijk" en "Betty Boop"), Kadinsky (Langebrugsteeg 7a, 2x) en Bullwacki (Woestduinstraat 76, 2x met een andere postcode).

## Wat er verandert

**1. Gelieerde leden**
Bij een lid kun je aangeven dat het gelieerd is aan een ander lid (zelfde eigenaren of zelfde pand, aparte lidmaatschappen). Dat is zichtbaar op beide ledenprofielen. Staan twee gelieerde leden op hetzelfde adres, dan is dat geen melding meer maar de normale situatie: het overzicht toont alleen "gelieerd aan …". The Plug East en The Plug (Utopia) worden meteen zo aan elkaar gekoppeld.

**2. Drie duidelijke groepen in plaats van één rode lijst**

- *Zelfde vestiging dubbel ingevoerd* — zelfde lid, zelfde adres én postcode, praktisch dezelfde naam (Hunters, Paradox, Kadinsky). Eén knop: samenvoegen tot één vestiging.
- *Controleren* — zelfde lid en adres, maar een andere naam of postcode (Boerejongens/Betty Boop, Bullwacki). Hier kies je zelf: samenvoegen én welke naam en gegevens blijven staan, of "dit zijn twee zaken" waarmee het geval verdwijnt.
- *Zelfde adres, verschillende leden* — alleen informatie, met een knop "gelieerd aan elkaar" of "dit klopt".

**3. Eenmaal beoordeeld is weg**
Klik je "dit klopt" of "dit zijn twee zaken", dan komt het geval niet meer terug — ook niet na een nieuwe synchronisatie.

**4. Tekst aangepast**
De koppen en uitleg spreken niet meer over fouten, maar over "controleren". Het overzicht toont per geval waaróm het wordt getoond (zelfde adres én postcode, of alleen zelfde adres).

## Wat niet verandert

De tellingen van aangesloten coffeeshops blijven zoals ze zijn: die tellen al per lid en voegen nooit vestigingen van verschillende leden samen. Er wordt niets automatisch samengevoegd of verwijderd; elke wijziging blijft een klik van jou.

## Technisch

- Nieuwe tabel `member_affiliations` (`member_id`, `related_member_id`, `notitie`), symmetrisch gelezen, met bestuur/beheer-rechten en de gebruikelijke grants. Rij voor 51 ↔ 66 wordt direct aangemaakt.
- Nieuwe tabel `location_duplicate_dismissals` (`groep_sleutel` = genormaliseerd adres + postcode + betrokken lidnummers, `reden`, `door`, `op`) met unieke sleutel, zodat beoordeelde gevallen verdwijnen.
- `KoppelingenAuditPanel` splitst de groepen op basis van adres + postcode + naamgelijkenis (`compact`-vergelijking, naam-token-overlap) in plaats van alleen adres; gelieerde leden en weggeklikte groepen worden eruit gefilterd.
- Samenvoegen krijgt een keuze welke regel blijft: `useMergeDuplicateLocations` accepteert al `keepKey`, de UI biedt nu per regel een "behoud deze"-keuze in plaats van automatisch de meest gevulde.
- `MemberDetail` toont "Gelieerd aan …" met een beheerknop om de koppeling te leggen of te verwijderen; nieuwe hook `useMemberAffiliations`.
