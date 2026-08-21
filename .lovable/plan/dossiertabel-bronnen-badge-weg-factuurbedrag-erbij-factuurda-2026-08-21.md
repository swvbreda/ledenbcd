# Dossiertabel: bronnen-badge weg, factuurbedrag erbij, factuurdatums vullen

## 1. "2 bronnen" vervangen door een waarschuwingsballonnetje
- De grijze badge "2 bronnen" verdwijnt uit de dossiertabel en het detailvenster.
- In plaats daarvan een klein icoontje achter het bedrag met een tooltip, bijvoorbeeld:
  "Samengevoegd: bankafschrijving + factuurboeking op hetzelfde factuurnummer (mogelijke dubbele boeking)."
- De tooltip somt per bron kort op: bron (bank/Informer), datum, factuurnummer en bedrag, zodat je in één oogopslag ziet wat er is samengevoegd.

## 2. Kolom "Factuurbedrag"
- Nieuwe kolom naast Bedrag: het bedrag van de factuurboeking (Informer/handmatig).
- Bedrag blijft de werkelijke bankafschrijving (leidend).
- Wijken ze af, dan wordt het factuurbedrag geaccentueerd — dat is precies het signaal voor bundeling, verrekening of een dubbele betaling.
- Bij regels zonder factuurboeking blijft de cel leeg.

## 3. Ontbrekende factuurdatums
Bankregels hebben zelf geen factuurdatum; die komt van de gekoppelde factuurboeking. Nu blijft de kolom leeg zodra de koppeling mislukt. Twee aanvullingen:
- **Betere nummervergelijking:** factuurnummers worden genormaliseerd (spaties, `+`, `/` en voorloopnullen weggehaald) voordat ze vergeleken worden, zodat `0260079` / `20260079` en `20260306+20260297` alsnog matchen met de bankregel.
- **Terugval op de factuur zelf:** is er geen factuurboeking maar wel een geüpload factuurdocument met factuurnummer, dan wordt de factuurdatum daaruit overgenomen (documentdatum als benadering, herkenbaar gemarkeerd).
- Blijft er echt niets over, dan toont de cel "–" met een tooltip "geen factuurboeking gevonden".

## Technisch
- `src/lib/ledgerDedupe.ts`: `normalizeInvoiceNo` toevoegen en gebruiken in `sharesInvoiceNumber` / `invoiceNumbersIn`.
- `src/hooks/useDossiers.ts`: `DedupedEntry` uitbreiden met `invoiceAmount` (som van niet-bank bronnen) en `invoiceDate` vullen via de verbeterde match plus fallback uit `expense_documents`.
- `src/components/budget/DossierOverzichtTab.tsx` en `DossierDetailDialog.tsx`: badge vervangen door tooltip-icoon, kolom Factuurbedrag toevoegen.
- Geen databasewijzigingen; alleen weergave en matchlogica.
