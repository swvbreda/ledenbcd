# Verhuizingen uit het register doorvoeren in het ledenbestand

## Wat er aan de hand is (geverifieerd)

- Taffne is in de bron verhuisd van **Kloosterstraat 23, 1941BN** naar **Markt 59, 1941BM** (bron bijgewerkt vandaag 10:03; onze registersync draaide om 05:20, dus onze registerregel staat nog op het oude adres).
- De bevestigde koppeling met lid 67 wijst via `location_key` naar `tafne|kloosterstraat23|1941bn`.
- De vestiging bij lid 67 staat nog op Kloosterstraat 23.
- Belangrijker: zodra de registerregel vannacht wél bijwerkt, herkent de aanvullogica de vestiging niet meer (die matcht op postcode + huisnummer of naam+plaats). Gevolg: er wordt een **tweede locatie** "Taffne, Markt 59" bij het lid aangemaakt in plaats van een adreswijziging. Dat is dezelfde soort dubbeling als eerder bij Green House.

## Oplossing

1. **Koppeling is leidend bij het terugvinden van de vestiging.** Bij het aanvullen wordt eerst de bevestigde koppeling (`location_key`) gebruikt om de juiste ledenvestiging te vinden; pas als die niets oplevert wordt op adres/naam gezocht. Een verhuisde shop wordt dan herkend als dezelfde vestiging.
2. **Verhuizing wordt een voorstel, geen duplicaat.** Wijkt het adres of de postcode af, dan komt er een voorstel "Adres: Kloosterstraat 23 → Markt 59" en "Postcode: 1941BN → 1941BM" in de Aanvullingen-lijst. Niets wordt stil overschreven.
3. **Bij overnemen schuift de koppeling mee.** Na het toepassen van een adres-/postcodevoorstel wordt de `location_key` van de koppeling bijgewerkt naar het nieuwe adres, zodat volgende syncs weer kloppen.
4. **Zichtbaar als verhuizing.** In de Aanvullingen-lijst krijgen adres- en postcodewijzigingen van een gekoppelde vestiging een label "Verhuizing", met daaronder de oude en nieuwe locatie bij elkaar zodat je ze in één keer kunt overnemen.
5. **Nu direct oplossen voor Taffne.** Registersync handmatig draaien, daarna aanvullen; het verhuisvoorstel voor lid 67 verschijnt dan in de lijst en kan worden overgenomen.

## Technisch

- `enrich-members-from-register`: locatiebepaling per bevestigde link eerst via `location_key` (met dezelfde matchvolgorde als `src/lib/registerLocationMatch.ts`), daarna pas `sameLocation`. Alleen als er geen link-locatie én geen adresmatch is, wordt een nieuwe locatie aangemaakt.
- `useResolveProposal` in `src/hooks/useCoffeeshopRegister.ts`: na het toepassen van veld `adres`/`postcode` de bijbehorende rij in `coffeeshop_member_links` bijwerken met de nieuwe `location_key` (`naam|adres|postcode`, genormaliseerd).
- `RegisterEnrichmentPanel.tsx`: adres/postcode-voorstellen van dezelfde vestiging groeperen onder één "Verhuizing"-blok met één knop Overnemen.
- Geen schemawijziging nodig; factuurvelden blijven uitgesloten van registerverrijking.
