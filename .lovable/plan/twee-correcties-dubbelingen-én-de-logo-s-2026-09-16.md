# Twee correcties: dubbelingen én de logo's

## Deel 1 — Logo's: nu vaak een sfeerfoto

Alle 115 opgehaalde plaatjes komen van de website van de shop, en daar wordt nu als eerste de "deelafbeelding" gepakt (het plaatje dat verschijnt als je een link deelt). Dat is bij The Bulldog het logo, maar bij de meeste anderen een foto van de zaak. Vandaar het verschil.

**Wat er verandert**

- Er wordt eerst gezocht naar een échte logo-afbeelding: het website-icoon (apple-touch-icon / favicon), een afbeelding waarvan de bestandsnaam of het bijschrift "logo" bevat, of het logo in de kop van de site. Pas als dat er allemaal niet is, wordt de deelafbeelding gebruikt — en dan als "foto" gemarkeerd in plaats van als logo.
- Te kleine of te brede plaatjes (banners, bannerstrips) worden overgeslagen.
- Alle 115 al opgehaalde plaatjes worden opnieuw bekeken met de nieuwe volgorde, zodat de foto's worden vervangen door het echte logo waar dat te vinden is.
- Bij een lid dat zelf een logo uploadt, verandert er niets: dat blijft altijd voorgaan.

Waar geen logo te vinden is, blijft de kaart met de initialen staan (zoals nu bij "HD", "GD"). Dat is beter dan een willekeurige foto.

## Deel 2 — "Dubbele" vestigingen: minder streng, duidelijker

Mijn vorige overzicht noemde alles met hetzelfde adres "dubbel". Dat klopt niet: twee leden kunnen prima op hetzelfde adres zitten, en een zaak kan zijn overgenomen en hernoemd.

**Wat er nu echt staat**

- Hetzelfde adres bij twee leden (1 geval): 1e Oosterparkstraat 47 Amsterdam — The Plug East (lid 51) en The Plug (Utopia) (lid 66).
- Hetzelfde adres binnen één lid (5 gevallen): Hunters (Utrechtsestraat 14, 3x), Coffeshop Paradox (1e Bloemdwarsstraat 2, 2x), Boerejongens (Humberweg 2: "Boerejongens Sloterdijk" en "Betty Boop"), Kadinsky (Langebrugsteeg 7a, 2x) en Bullwacki (Woestduinstraat 76, 2x).

**Wat er verandert**

- **Gelieerde leden**: bij een lid kun je aangeven dat het gelieerd is aan een ander lid (zelfde eigenaren of zelfde pand, aparte lidmaatschappen). Dat staat op beide ledenprofielen. Staan gelieerde leden op hetzelfde adres, dan is dat geen melding meer. The Plug East en The Plug (Utopia) worden meteen zo gekoppeld.
- **Drie groepen in plaats van één rode lijst**: (a) zelfde lid, zelfde adres én postcode, vrijwel dezelfde naam → knop samenvoegen; (b) zelfde lid en adres maar andere naam of postcode (Boerejongens/Betty Boop, Bullwacki) → jij kiest welke naam en gegevens blijven staan, of "dit zijn twee zaken"; (c) zelfde adres bij verschillende leden → alleen informatie, met knop "gelieerd" of "dit klopt".
- **Eenmaal beoordeeld is weg**: wat je wegklikt komt niet meer terug, ook niet na een synchronisatie.
- De teksten spreken niet meer over fouten maar over controleren, met per geval de reden waarom het wordt getoond.

De tellingen van aangesloten coffeeshops blijven ongewijzigd: die tellen al per lid en voegen nooit vestigingen van verschillende leden samen.

## Technisch

- `register-enrich.ts`: `parseSite` krijgt een kandidatenlijst met score — `link[rel*=icon]` (apple-touch eerst), `<img>` met "logo" in `src`/`alt`/`class`, `og:logo`, en pas daarna `og:image` (opgeslagen met `logo_bron = "foto"`). Minimale grootte 500 bytes, verhoudingsfilter via de bytes/extensie; svg altijd toegestaan. Eenmalige herloop over de 115 rijen met `logo_bron = 'website'` door `logo_url`/`logo_pad`/`web_checked_at` leeg te zetten en de bestaande batch-route opnieuw te draaien.
- Nieuwe tabel `member_affiliations` (`member_id`, `related_member_id`, `notitie`) met bestuur/beheer-policies en grants; symmetrisch gelezen; rij 51 ↔ 66 direct aangemaakt.
- Nieuwe tabel `location_duplicate_dismissals` (`groep_sleutel`, `reden`, `door`, `op`, uniek op sleutel).
- `KoppelingenAuditPanel`: groepeert op adres + postcode + naamgelijkenis in plaats van alleen adres; filtert gelieerde leden en weggeklikte groepen; samenvoegen krijgt een keuze welke regel blijft (`useMergeDuplicateLocations` ondersteunt `keepKey` al).
- `MemberDetail`: blok "Gelieerd aan …" met beheerknop; nieuwe hook `useMemberAffiliations`.
