# Plan: gemeente en stadsdeel allebei behouden

## Doel
Voorkomen dat een stadsdeel zoals “Centrum” wordt vervangen door een gemeente zoals “Rotterdam”. Locaties moeten voortaan aparte velden hebben voor:

- **Plaats**: woonplaats/stad uit adres, bijvoorbeeld Rotterdam
- **Gemeente**: bestuurlijke gemeente uit het register, bijvoorbeeld Rotterdam
- **Stadsdeel**: wijk/stadsdeel binnen de stad, bijvoorbeeld Centrum

## Wat ik aanpas
1. **Locatiemodel uitbreiden**
   - Voeg een apart veld `gemeente` toe aan locaties.
   - Laat `stadsdeel` bestaan voor echte stadsdelen/wijken.
   - Bestaande locatiegegevens blijven behouden.

2. **Register-aanvullingen corrigeren**
   - De registerwaarde `gemeente` wordt niet langer voorgesteld als wijziging op `stadsdeel`.
   - Nieuwe voorstellen tonen “Gemeente” als apart veld.
   - Bestaande open voorstellen die `stadsdeel` willen vervangen door een registergemeente worden genegeerd of omgezet naar een gemeente-voorstel, zodat je ze niet handmatig hoeft weg te klikken.

3. **Nieuwe registerlocaties juist vullen**
   - Bij ontbrekende ledenlocaties vult de koppeling voortaan:
     - `plaats` vanuit de registerplaats
     - `gemeente` vanuit de registergemeente
     - `stadsdeel` blijft leeg tenzij we daar echte stadsdeeldata voor hebben

4. **Ledenpagina en bewerken-scherm bijwerken**
   - Toon gemeente en stadsdeel apart op locatiekaarten wanneer beide bekend zijn.
   - In het bewerkformulier komt een apart veld “Gemeente” naast “Stadsdeel”.
   - De stadsdeelkeuze blijft beschikbaar, maar wordt niet meer gebruikt voor registergemeenten.

5. **Opschoning bestaande data**
   - Voor locaties waar een gemeente per ongeluk in `stadsdeel` is terechtgekomen, verplaats ik die naar `gemeente` wanneer dat veilig kan.
   - Echte stadsdelen zoals “Centrum” blijven in `stadsdeel` staan.
   - Het screenshotgeval wordt daarmee: `stadsdeel = Centrum`, `gemeente = Rotterdam`.

## Technische details
- De huidige verrijkingslogica gebruikt registerveld `gemeente` als kandidaat voor locatieveld `stadsdeel`; dat wordt gewijzigd naar locatieveld `gemeente`.
- De acceptatie van aanvullingsvoorstellen schrijft locatievelden direct weg; die logica blijft hetzelfde, maar krijgt het nieuwe veld mee.
- Omdat locaties als JSON in het ledenbestand staan, is waarschijnlijk geen tabelkolom-migratie nodig voor het nieuwe veld. Wel is een data-opruiming nodig voor bestaande JSON-data en open voorstellen.
- Na de wijziging controleer ik de register-aanvullingen en een leden-detailpagina met locaties waar plaats, gemeente en stadsdeel verschillen.
