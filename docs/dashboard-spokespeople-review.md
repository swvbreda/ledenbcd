# Dashboardwoordvoerders — previewreview 5 november 2026

## Actuele bron en oorzaak

Gelezen: https://coffeeshopbond.nl/over-ons, bronproject Coffeeshopbond `ad4fe468-a3c4-4d88-8f3f-4515abd526e9`, snapshot `ced03942`, `src/routes/over-ons.tsx:275–369`, en huidige `board_members`/`get_board_members_public` in dit portaal. De www-host verwijst met HTTP 302 naar deze apex-host; de adapter leest rechtstreeks de HTTP 200-bron zonder redirects.

| Afdeling | Exact gepubliceerde naam | Probleem vóór fix |
|---|---|---|
| Amsterdam | Dhr. J. (Joachim) Helms | Joachim bestaat als landelijk bestuurder, maar Amsterdam ontbreekt als afdeling |
| Arnhem | H. (Hannes) Poppinghaus | Bestaand record `2729b605-86d8-4763-b4dc-9145cea93e6d` staat onder Aspirant, niet als afdeling |
| Enschede | T. (Tugrulhan) Akca | Bestaand record `cb9155f3-2fb6-4853-b9da-078f0fa87532` staat onder Aspirant, niet als afdeling |
| Rotterdam | Dhr. M. (Michel) Wouters | Ontbreekt geheel in de dashboardbestuursfeed |

Het bronproject voegt Amsterdam en Rotterdam uitsluitend in de openbare pagina toe (`extraLokaal`); zijn bestuursfeed komt juist uit dit ledenportaal. Daarom lost alleen opnieuw ophalen van `get_board_members_public` het verschil niet op. Geen bronproject-database gelezen: checkout biedt alleen code, geen toegang tot private bronrecords.

## Beperkte diff

- `src/components/BestuurOverzicht.tsx`: eigen sectie Lokale afdelingen, bestaande bestuurskaart behouden; lokale woordvoerderfuncties niet langer onder Aspirant; telefoonuitklapping zonder vaste hoogte-afkap; duidelijke bronfout en opnieuw-ladenknop.
- `src/lib/localSpokespeople.functions.ts`: bestaande sessiemiddleware, geen account/rolwijzigingen, geen databasewrites.
- `src/lib/localSpokespeople.server.ts`: vaste openbare bron, 8 seconden totale timeout, maximaal 2 MB, geen redirects/HTML-uitvoering/credentials.
- `src/lib/localSpokespeople.ts`: uitlezen uitsluitend afdelingssectie; namen, afdelingen en gepubliceerde bondmailadressen; lege/ambigue bron geeft fout, geen verzonnen fallback. Bij bronfout toont dashboard uitsluitend bestaande lokale records met zichtbare waarschuwing.
- Parserfixture, 4 parsertests en 2 integratietests; `vitest.spokespeople.config.ts`; `parse5` als expliciete dependency; architectuurregel en alleen deze roadmapregel bijgewerkt.

Geen parallel register, migratie, wijziging aan bestuursrecords, authrollen, contactgegevens of andere open taken. Geen publicatie/deploy.

## Verificatie en grens

- Nieuwe adapter heeft daadwerkelijk alle vier bovenstaande namen/afdelingen en hun gepubliceerde bondmailadressen teruggelezen uit de actuele website.
- Zes gerichte tests geslaagd: concrete namen/afdelingen, lege/ambigue bron, onbetrouwbare links/scripts, HTTP-fout/maximale grootte, bestaande bestuursfeed en expliciete foutfallback. Herhaalbaar: `bunx vitest run -c vitest.spokespeople.config.ts`.
- Automatische preview-bouwcontrole meldt `build OK` (laatste codecontrole 10:43:15 UTC); geen handmatige volledige build/typecheck uitgevoerd conform platforminstructies.
- Playwright controle van echte component met actuele bronreadback: desktop 1280×1800 en mobiel 390×844, vier afdelingen zichtbaar, mobiele uitklapping werkt, geen horizontale overflow en geen browser-runtimefouten. Screenshots onder `/tmp/browser/wordvoerders/desktop.png` en `mobile.png`.
- Schermcontrole was een **afzonderlijke componentfixture**, niet een ingelogd volledig dashboard: beschikbare sessie stond signed_out en `auth-session --self` kon geen overeenkomend account minten. Geen fictieve sessie of auth-bypass gebruikt. De fixture bevat één bestuursrecord en de vier actuele bronvermeldingen. Echte ingelogde dashboardketen vereist nog gebruikersreview in preview.
- De adapter volgt het gepubliceerde HTML-contract omdat geen bestaande reverse woordvoerders-API bestaat. Bij wijziging van de bronindeling wordt dit expliciet zichtbaar, niet stil als compleet gepresenteerd.