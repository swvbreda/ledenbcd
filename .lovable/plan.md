# Duidelijker maken welk lid je bevestigt

Nu staat bij een voorstel het beste lid bovenaan en verschijnen alternatieven als kale knoppen achter "Of:". Onduidelijk is welk lid de knop "Bevestigen" koppelt en waarom een alternatief wordt genoemd.

## Wat er verandert (WhatsApp-community, tab met voorstellen)

- Elk voorstel toont de kandidaten als een keuzelijst met keuzerondjes; de best scorende staat voorgeselecteerd.
- Per kandidaat komt op één regel: lidnaam + lidnummer, plaats, en de reden ("contactpersoon Danny Stone", "vestiging Thunderbird").
- De actieknop krijgt de naam van het geselecteerde lid: "Koppel aan Baba Souvernir" in plaats van alleen "Bevestigen", zodat er geen twijfel is over wat je bevestigt.
- Boven de knop een korte regel: "Deelnemer <naam> koppelen aan:".
- "Duidelijke bevestigen" blijft, maar krijgt de tekst "Alleen eenduidige voorstellen bevestigen" met tooltip die uitlegt dat voorstellen met meerdere kandidaten worden overgeslagen.
- Het kruisje blijft "Voorstel negeren" (alleen verbergen, niets in de database).

## Technisch

Alleen presentatie in `src/components/CommunityTodoList.tsx`: lokale state per voorstel met de gekozen `memberId`, `applyLinks([gekozenKandidaat])` bij klik. Matchlogica in `src/lib/communityMatch.ts` blijft ongewijzigd; plaats/lidnummer komen uit de al geladen ledenlijst.
