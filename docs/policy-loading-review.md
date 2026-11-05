# Beleid laden — gerichte controle 5 november 2026

## Feitelijke huidige uitkomst

- Gepubliceerde bron `https://coffeeshopbeleid.com`, bestaande afgeleide HMAC-header en contract v1 werken. Geen sleutels in URLs, browser of dit verslag.
- `/api/public/bcd-documenten/v1/gemeenten`: HTTP 200, 342 gemeenten (eerste meting 3,09 seconden).
- `/api/public/bcd-documenten/v1/documenten?gm_code=GM0363&limit=20`: HTTP 200, 20 openbare bronstukken, geldige vervolgcursor (eerste meting 3,12 seconden). Voorbeeld: “Aanvraag (Nieuw) exploitatievergunning horecabedrijf - Surinamestraat 7-H in Amsterdam”, 2025-09-08, canoniek ID `004f8855-e439-4524-a0be-da6131871d64`.
- De echte responses zijn ook door de bestaande portalparser gelezen: Amsterdam GM0363 20, Rotterdam GM0599 20, Arnhem GM0202 20, Enschede GM0153 5, Den Haag GM0518 10, Utrecht GM0344 20, Haarlem GM0392 7. Dit zijn pagina-aantallen, geen gemeente-totalen. Tweede meting na fix geslaagd, 185–2590 ms per documentpagina.
- Bronproject read-only snapshot `be040f32` bevat beide v1-routes. Contract/header/afleiding en cursor passen. De historische ontbrekende route (404) is nu niet gereproduceerd; geen noodzakelijke bronreparatie vastgesteld.
- De publieke live portalassets bevatten beide beleidscomponenten. Gepubliceerde workerlogs van het laatste uur bevatten geen benoemde bcd-fout; een 200 serverfunctie-response bewijst op zichzelf geen geslaagde beleidsresponse.
- De huidige DB bevat de bestaande `bcd_documenten_rate_hit` (60 verzoeken/minuut) en `support_my_member_id`. Geen rechten, records of instellingen gewijzigd.

## Gerichte wijzigingen

- `src/lib/bcdDocumenten.ts`: bronroute-404 en echte timeout onderscheiden; response-body lezen binnen dezelfde foutgrens als fetch. Een afgebroken body wordt geen ongeclassificeerde exception.
- `src/lib/bcdDocumenten.functions.ts`: uitsluitend veilige foutreden in serverlog, geen broninhoud of credentials; bestaande autorisatie, rate limit en HMAC blijven staan.
- `src/components/beleid/BeleidDocumentenKiezer.tsx` en `BeleidDocumentenLijst.tsx`: ontbrekende sessie niet langer eindeloos “laden”; bij bronfout expliciete handmatige herpoging, geen verborgen standaardquery-retries. Geen demo/lege succesfallback.
- Gerichte adaptertests en componenttests; aparte `vitest.policy.config.ts` vermijdt appplugins tijdens adaptertests.

## Verificatie en grenzen

- Adaptertests: inclusief HTTP-statussen, header-only sleutel, redirectverbod, gemeente-isolatie, fout tijdens body lezen en echte abortclassificatie.
- Vier componenttests: bestaande documenten/paginering, onderscheid bronfout/ontbrekende gemeente/echte lege lijst, herstel na handmatige herpoging en geen eindeloze spinner bij ontbrekende sessie.
- Componenttestrunner heeft een ontbrekende optionele `canvas.node`; tests succesvol herhaald met tijdelijke Node-resolver die alleen de optionele canvas dependency uitschakelt (geen app/dependencywijziging).
- Automatische bouwcontrole geeft `build OK`. Geen handmatige build/typecheck uitgevoerd conform projectharnessregels.
- Browser met normale sessieloze start `/locaties` eindigt op `/login`, zonder browsererrors. Geen toegang omzeild. `auth-session --self` vindt geen eigen beheerdersaccount; dus de ingelogde serverfunctie/DB-rechtenketen en beleidsweergave van Simone zijn NIET end-to-end geverifieerd. Geen andere account gekozen.
- De door Simone gemelde ingelogde foutoorzaak is hierdoor nog niet bewezen. Bovenstaande zijn concreet aangetroffen foutafhandelingsproblemen, niet het bewijs dat haar live probleem verdwenen is. Vereist: preview ingelogd openen, gemeente kiezen en eventueel zichtbare foutreden teruggeven.
- Woordvoerdersfix en overige bestaande wijzigingen behouden; geen publicatie, data-import, mail of bronmutaties.