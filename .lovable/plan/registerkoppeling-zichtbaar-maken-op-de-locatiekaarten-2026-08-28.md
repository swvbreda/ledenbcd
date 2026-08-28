# Registerkoppeling zichtbaar maken op de locatiekaarten

## Wat ik in de data zie (lid 67, Tafne)

Beide vestigingen zijn wel degelijk **bevestigd gekoppeld** aan het register:

| Koppeling (sleutel) | Registerregel |
|---|---|
| `tafne\|markt59\|1941bm` | Taffne — Markt 59, 1941BM Beverwijk |
| `regine\|gedempteoudegracht28\|2011gr` | Regine — Gedempte Oudegracht 28, 2011 GP Haarlem |

Maar in het ledenbestand staan deze vestigingen anders:

- **Tafne**: het basisrecord heeft het nieuwe adres *Markt 59, 1941BM*, maar de bewerkingslaag (`member_edits`) bevat nog het oude adres *Kloosterstraat 23, 1941BN*. De bewerkingslaag wint, dus de kaart gebruikt het oude adres.
- **Regine**: de koppelsleutel eindigt op postcode **2011GR**, terwijl zowel het register als het lid **2011 GP** heeft — één letter verschil.

De locatiekaart vergelijkt de koppelsleutel **letterlijk** met de sleutel van de vestiging. Zodra één teken afwijkt, valt de koppeling weg en toont de kaart "Niet gekoppeld". De terugvalmatching op adres/postcode/plaats geldt nu alleen voor koppelingen *zonder* sleutel. Bovendien verdwijnt zo'n koppeling ook uit het blok "Alleen in register", waardoor hij nergens meer zichtbaar is — precies wat je in de tweede schermafbeelding ziet.

## Wat ik ga doen

1. **Slimme koppeling op de locatiekaart** — als een koppelsleutel niet exact overeenkomt met een vestiging, wordt alsnog gematcht op de registerregel zelf (postcode + huisnummer, dan naam + plaats, dan adres). Dit gebruikt dezelfde matchlogica die elders in de app al werkt.
2. **Verhuisde vestigingen blijven gekoppeld** — bij een adreswijziging wordt ook op de oude en nieuwe waarden van de koppeling gematcht, zodat de kaart niet leegvalt zolang het lid nog het oude adres heeft staan.
3. **Nooit meer onzichtbaar** — een koppeling die aan geen enkele vestiging gehangen kan worden, verschijnt weer onder "Alleen in register" met de keuzelijst om hem handmatig aan een vestiging te koppelen.
4. **Sleutels bijwerken bij een treffer** — als er via terugval een eenduidige match is, wordt de koppelsleutel stilzwijgend gecorrigeerd naar de actuele vestiging, zodat de fout zich niet herhaalt.
5. **Deze twee gevallen rechtzetten** — koppelsleutel van Regine corrigeren naar de juiste postcode, en het verouderde adres van Tafne in de bewerkingslaag bijwerken naar Markt 59, 1941BM (het register en het basisrecord zijn het daar al over eens).

## Technisch

- `src/pages/MemberDetail.tsx`: `linkByLocation` herschrijven zodat elke koppeling (met of zonder `location_key`) via `findMemberLocation` uit `src/lib/registerLocationMatch.ts` aan een vestiging wordt gehangen; exacte sleutel blijft eerste keus, daarna registergegevens als terugval. `matchedLinkIds` volgt automatisch, zodat niet-gematchte koppelingen weer in het blok "Alleen in register" landen.
- Zelfde afhandeling toepassen op de plek waar de koppelstatus per vestiging elders wordt getoond, zodat teller en kaart hetzelfde zeggen.
- Datacorrectie via SQL op `coffeeshop_member_links.location_key` (Regine) en `member_edits.data->locaties` (Tafne-adres). Geen schemawijziging.
