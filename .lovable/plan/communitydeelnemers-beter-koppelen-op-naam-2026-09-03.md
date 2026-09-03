# Communitydeelnemers beter koppelen op naam

## Wat er nu misgaat (gecontroleerd in de data)
Van de 272 deelnemers zijn er nog 80 zonder lid, waarvan 62 zonder telefoonnummer. De huidige naamvergelijking eist dat de hele weergavenaam gelijk is aan (of volledig voorkomt in) één ledennaam, én dat er precies één lid overblijft. Daardoor valt bijna alles af:

- `Michael Coffeeshop Thunderbird` — contactpersoon "Michael" komt bij meerdere leden voor, dus wordt hij genegeerd, terwijl "Thunderbird" precies één lid aanwijst.
- `Guus Coffeeshop Caramba`, `Elton Coffeeshop Andorra`, `Mark Smokersguide Rooyakkers` — de shopnaam in de weergavenaam wordt nu niet gebruikt.
- `Johnny Elbers`, `Tim de Wilde`, `Sander Plamont` — matchen op voornaam bij meerdere leden en worden daarom helemaal weggelaten in plaats van als keuze aangeboden.

## Aanpak
1. **Naam opdelen in woorden.** Weergavenaam en ledennamen worden in losse woorden vergeleken, met ruiswoorden eruit (`coffeeshop`, `shop`, `koffieshop`, `bv`, `the`, `van`, `de`, `der`, enz.) en zonder `~`, accenten en leestekens.
2. **Shopnaam telt zwaar mee.** Bevat de weergavenaam een woord dat overeenkomt met de naam van een lid of van een van zijn vestigingen (Thunderbird, Caramba, Andorra), dan wijst dat het lid aan — ook als de voornaam bij meer leden voorkomt.
3. **Persoonsnaam scoort per woord.** Volledige voor- én achternaam bij een contactpersoon = sterke match; alleen achternaam = redelijke match; alleen voornaam = zwakke match.
4. **Niet meer stil weglaten.** Blijven er meerdere kandidaten over, dan komt de deelnemer als voorstel in de lijst met de beste 3 kandidaten om uit te kiezen, in plaats van te verdwijnen.
5. **Zichtbare reden.** Bij elk voorstel staat waarom: "contactpersoon Michael" of "vestiging Thunderbird", zodat je snel kunt bevestigen of negeren.
6. **Zeker blijft zeker.** Telefoonmatches blijven de enige matches die automatisch worden toegepast; naammatches vereisen altijd een klik.

## Technisch
- `src/lib/communityMatch.ts`: tokenizer + scorefunctie; `MatchResult` krijgt `score` en `detail` (reden), en de uitkomst levert per deelnemer een gesorteerde kandidatenlijst (max 3) in `suggested`.
- `src/components/CommunityTodoList.tsx`: voorstelrij toont de reden en, bij meerdere kandidaten, keuzeknoppen per lid; "Alles bevestigen" pakt alleen deelnemers met één duidelijke topkandidaat.
- Naamvelden die worden meegenomen: `contactpersoon`, `contactpersoon2`, `contactpersonen`, `contacten[].naam`, `naam`, `bedrijfsnaam`, `locaties[].naam`.
- Geen databasewijzigingen; alleen matchlogica en de koppel-UI.
- Testdekking in `src/lib/communityMatch.test.ts` voor de voorbeelden hierboven.
