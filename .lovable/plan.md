# Locatieverwijdering betrouwbaar maken

## Doel
Een verwijderde vestiging moet na opslaan direct én blijvend uit het ledenprofiel verdwijnen, ook wanneer meerdere vestigingen dezelfde postcode hebben.

## Bevestigde oorzaak
Bij lid 9 staat **Utrechtsestraat 47** nog in de basisgegevens, terwijl de opgeslagen bewerking vier locaties bevat en `_verwijderdeLocaties` leeg is. De huidige locatie-identiteit gebruikt eerst alleen de postcode. Utrechtsestraat 21 en 47 hebben beide postcode `1017 VH`, waardoor de verwijderlogica ze als dezelfde locatie beschouwt.

## Aanpak
1. **Maak verwijderidentiteiten uniek per fysiek adres**
   - Gebruik voor verwijderen een stabiele combinatie van postcode en volledig adres.
   - Behoud terugwaartse compatibiliteit met bestaande verwijdermarkeringen, zodat eerder verwijderde locaties niet terugkomen.
   - Laat bestaande contactpersoon-naar-locatiekoppelingen ongemoeid.

2. **Pas opslaan en samenvoegen aan**
   - Laat het bewerkformulier verwijderde locaties vergelijken met de nieuwe, adres-specifieke sleutel.
   - Laat de opslaghook bestaande en nieuwe verwijdermarkeringen correct samenvoegen.
   - Laat de weergavemerge een expliciet verwijderd adres uitsluiten zonder een andere vestiging met dezelfde postcode te raken.

3. **Herstel de huidige gegevens**
   - Voeg voor lid 9 de correcte verwijdermarkering voor Utrechtsestraat 47 toe, zonder overige leden- of locatiegegevens te overschrijven.

4. **Regressietests en controle**
   - Voeg een test toe met twee verschillende adressen binnen dezelfde postcode: alleen het gekozen adres verdwijnt.
   - Controleer dat verwijderen, opslaan en opnieuw openen vier locaties toont en Utrechtsestraat 21 behouden blijft.
   - Draai typecheck en relevante tests.

## Technische details
- Frontendlogica: `src/lib/memberLocations.ts`, `src/components/MemberEditForm.tsx`, `src/hooks/useMemberEdits.ts`.
- Test: `src/lib/memberLocations.test.ts`.
- Bestaande databasevelden blijven behouden; alleen de foutieve bewerkingsdata van het getroffen lid wordt gericht gecorrigeerd.
