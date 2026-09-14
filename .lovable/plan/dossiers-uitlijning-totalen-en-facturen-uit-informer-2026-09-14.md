# Dossiers: uitlijning, totalen en facturen uit Informer

## 1. Uitlijning van de blokken

In het dossiervenster lopen de drie kaarten (Uitgaven/Inkomsten/Saldo), de tabel en de knop "Factuur toevoegen" buiten de rand van het venster. Oorzaak: de tabel met negen kolommen is breder dan het venster, en er is geen horizontale schuifbalk.

- Het venster wordt breedte-begrensd op het scherm in plaats van vast; inhoud kan niet meer buiten de rand vallen.
- De mutatietabel krijgt een eigen horizontale schuifbalk, zodat brede kolommen netjes binnen het kader blijven.
- De drie kaarten schalen mee: naast elkaar op groot scherm, onder elkaar op mobiel.
- De knop "Factuur toevoegen" staat weer netjes op één lijn boven de facturenrij.

## 2. Totalen van de dossiers

Gecontroleerd in de administratie voor "Amsterdam i-criterium": de weergave (€ 37.644,56) is de optelsom van vier eigen bankbetalingen (€ 24.701,84) plus twee toegewezen delen van betalingen die bij Worldline staan (€ 12.826,00 en € 116,72).

Het deel van € 12.826,00 komt uit de betaling van 5 februari (€ 21.624,64). Maar factuur 20260165 van € 12.826,00 is óók als losse betaling op 16 maart in dit dossier geboekt. Datzelfde bedrag telt dus twee keer mee. Bij het deel van € 116,72 uit de betaling van 29 maart speelt hetzelfde risico.

- Ik loop de bestaande verdelingen na tegen de factuurnummers in de betalingsomschrijvingen en corrigeer de verkeerde toewijzing, zodat elk factuurbedrag nog maar één keer in een dossier meetelt.
- Ik voeg een controle toe: staat hetzelfde factuurnummer in één dossier zowel als los betaald bedrag als in een verdeling, dan verschijnt daar een waarschuwing bij, met een knop om de dubbele toewijzing te verwijderen.
- Deze controle draait over alle dossiers, niet alleen dit ene, zodat verborgen dubbeltellingen elders ook zichtbaar worden.

## 3. Facturen ophalen uit Informer

Nee, dat werkt nog niet. De laatste run van vannacht: 14 inkoopfacturen bekeken, 0 bestanden opgehaald. De eerste poging geeft "bestand bestaat niet" (404), alle volgende pogingen lopen tegen de aanvraaglimiet van Informer aan (429) — die worden dus niet eerlijk getest.

- Ik bouw pauzes met herhaalpogingen in tussen de adressen, zodat elk adres daadwerkelijk een antwoord geeft in plaats van een limietfout.
- Daarna draai ik de stap eenmalig handmatig en lees de uitkomst per adres uit.
- Blijkt Informer echt geen factuurbestanden aan te bieden, dan meld ik dat expliciet in het Informer-tabblad ("Informer levert geen factuurbestanden") en blijft handmatig uploaden de weg — zonder stille nullen.

## Technisch

- `src/components/budget/DossierDetailDialog.tsx`: `DialogContent` naar `w-[min(96vw,72rem)] max-w-none overflow-hidden`, kaartgrid naar `grid-cols-1 sm:grid-cols-3`, tabel in een container met `overflow-x-auto` en `min-w-[64rem]` op de tabel zelf.
- `src/hooks/useDossiers.ts`: naast `groupByDossier` een controle die per dossier factuurnummers van losse mutaties en van splits vergelijkt (`invoiceKeysOf` uit `ledgerDedupe`) en dubbele allocaties markeert; weergave in `DossierDetailDialog` en `DossierOverzichtTab`.
- Correctie van de rij in `expense_dossier_splits` na verificatie tegen factuurnummers 20260079/20260165/20260297/20260306.
- `supabase/functions/informer-sync/index.ts`, `fetchPurchaseInvoicePdf`: 429-afhandeling met wachttijd en herhaling per kandidaat-adres; uitkomst per adres in `document_diagnostics`. `InformerSyncTab.tsx` toont de conclusie.
