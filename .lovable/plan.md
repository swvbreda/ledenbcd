# Gemeentepagina op het register baseren en koppelingen sluitend maken

## Situatie nu

- De pagina Gemeenten rekent met een vast databestand (`coffeeshops-nl.json`): 601 shops verdeeld over 113 plaatsen. Het register bevat nu 601 actieve shops over 107 gemeenten, en wijkt op detail af (bijvoorbeeld Rotterdam: 41 in het vaste bestand, 42 in het register).
- Van de 159 vertegenwoordigde coffeeshops in het ledenbestand zijn er **131 bevestigd gekoppeld** aan een registervermelding. Er zijn dus 28 ledenlocaties zonder registerkoppeling. Van de 601 registershops zijn er 470 nog niet gekoppeld.

## Wat er verandert

**1. Gemeentecijfers rechtstreeks uit het register**

De totalen per gemeente en het landelijke totaal komen uit het coffeeshopregister in plaats van uit het vaste bestand. Omdat het register alleen voor bestuur en admins zichtbaar mag zijn, komt er een afgeschermde optelfunctie die uitsluitend aantallen per gemeente teruggeeft (geen adressen, geen vergunninghouders). Die is voor alle ingelogde leden op te vragen.

Gevolg: "Coffeeshops NL", het percentage vertegenwoordiging, G4-dekking en de marktaandelen per gemeente lopen automatisch mee met elke registersync.

**2. Gemeentenamen gelijktrekken**

Plaatsnamen van leden worden al naar gemeente vertaald; die vertaling gaat ook op de registerkant gelden, zodat bijvoorbeeld Den Haag/'s-Gravenhage en deelplaatsen bij dezelfde gemeente terechtkomen en de percentages niet boven 100% kunnen uitkomen.

**3. Registercontrole: 159 = 159**

Op de gemeentepagina komt een controleblok "Aansluiting op het register" met drie getallen: vertegenwoordigde locaties (159), daarvan gekoppeld aan het register (131), en nog te koppelen (28). Zolang die niet gelijk zijn, is het blok zichtbaar als aandachtspunt.

Voor bestuur en admins is het blok uitklapbaar en toont het:
- welke ledenlocaties nog geen registerkoppeling hebben, met per locatie een knop om direct de bijbehorende registershop te zoeken en te koppelen (dezelfde bevestigingsdialoog met vergelijking die al bestaat);
- ledenlocaties waarvoor geen enkele registershop in die gemeente te vinden is — die kunnen gemarkeerd worden als "niet in register" (bijvoorbeeld afhaalpunt of net vervallen vergunning), zodat ze niet blijven terugkomen als openstaand punt;
- omgekeerd: bevestigde koppelingen waarbij de registershop vervallen is, zodat die opgeruimd of ontkoppeld kunnen worden.

**4. Automatisch aanvullen**

De registersync koppelt al automatisch bij hoge zekerheid (KvK 95%, naam+adres). Alle resterende twijfelgevallen komen bij Goedkeuringen te staan, zoals nu. Het doel is dat het verschil van 28 via die twee routes naar nul gaat; wat niet te koppelen is, krijgt de markering "niet in register" en telt niet meer als openstaand.

## Technisch

- Nieuwe security-definer RPC `get_register_gemeente_stats()` → `(gemeente text, aantal int)` over `coffeeshop_register` waar `vervallen = false`, met gemeentenormalisatie in SQL; `GRANT EXECUTE` aan `authenticated`. Plus `get_register_link_summary()` → totaal actieve shops, aantal bevestigde koppelingen, aantal ledenlocaties.
- Nieuwe hook `src/hooks/useRegisterStats.ts` (react-query) die beide RPC's ophaalt; `src/pages/LocatiesPage.tsx` en `src/pages/MarktaandeelPage.tsx` gebruiken die in plaats van `coffeeshops-nl.json` (fallback op het JSON-bestand als de RPC faalt). `StatCards.tsx` gebruikt hetzelfde totaal.
- Nieuw component `src/components/register/RegisterCoverageCard.tsx`: toont 159/131/28, en voor bestuur/admin de lijst met ongekoppelde ledenlocaties (`countLocations`-logica uit `src/lib/locationCount.ts` als bron), koppelen via bestaand `ConfirmLinkDialog` + `useSetRegisterLink`.
- Migratie: kolom `register_status text` (of tabel `member_location_register_status` met `member_id`, `location_key`, `status`) om "niet in register" vast te leggen, met RLS voor bestuur/admin en de gebruikelijke GRANTs.
- `sync-coffeeshopregister` blijft ongewijzigd behalve dat het gemeentenormalisatie deelt met de RPC.
