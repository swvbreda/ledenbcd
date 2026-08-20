# Dossiers openen met mutaties en facturen

## Wat er nu misgaat
Het dossieroverzicht toont alleen uitgaven die aan een begrotingspost hangen; inkomsten worden overgeslagen en er is geen detailscherm. Bij de boekingen zitten op dit moment nul factuurbestanden — alleen contributiefacturen van leden zijn opgeslagen.

## Wat we bouwen

### 1. Dossier openen (detailscherm)
- Klik op een dossiernaam opent een detailvenster.
- Bovenin: totaal uit, totaal in, saldo, aantal mutaties en aantal facturen.
- Tabel met **alle** mutaties in het dossier: bankmutaties én handmatige/geïmporteerde boekingen, uitgaven én inkomsten, ook boekingen zonder begrotingspost (die vallen nu volledig weg).
- Per regel: datum, tegenpartij/crediteur, omschrijving, factuurnummer, categorie/begrotingspost, bedrag (in = groen, uit = rood), en een documentindicator.
- Vanuit een regel kun je het bestaande boekingsvenster openen of de regel uit het dossier halen.

### 2. Facturen als afbeeldingen
- Nieuwe private opslagbucket voor inkoopfacturen, alleen benaderbaar voor beheerders/penningmeester via ondertekende links.
- Per mutatie kun je een PDF of foto uploaden (slepen of kiezen); meerdere bestanden per boeking zijn mogelijk.
- In het dossierdetail komt een galerij met miniaturen van alle facturen; klikken opent de factuur groot (PDF in viewer, foto's als afbeelding) met knop om te downloaden.
- Bij een PDF wordt de eerste pagina als miniatuur getoond, zodat het overzicht echt visueel is.

### 3. Automatisch ophalen uit Informer
- De Informer-sync probeert bij elke inkoopfactuur het bijbehorende PDF-bestand op te halen en in de bucket te zetten, gekoppeld aan de boeking.
- Levert Informer geen bestand voor een factuur, dan blijft handmatig uploaden mogelijk; in het dossier zie je duidelijk welke mutaties nog geen factuur hebben.

## Technische aanpak
- Nieuwe tabel `expense_documents` (boeking- of banktransactie-id, bestandspad, bestandstype, bron `informer`/`manual`, uploader) met RLS voor admin/penningmeester en GRANTs; storage-policies op de nieuwe bucket.
- `DossierOverzichtTab.tsx` krijgt een klikbare dossierrij plus nieuwe `DossierDetailDialog.tsx`; de mutatielijst wordt niet meer alleen uit `categories → line_items → expenses` opgebouwd maar ook uit banktransacties en boekingen zonder begrotingspost, en `direction === "in"` wordt niet langer weggefilterd.
- Nieuwe edge function voor upload/ophalen van ondertekende URL's; `informer-sync` uitgebreid met een documentstap (PDF-endpoint per inkoopfactuur, fout tolerant en overslaan bij ontbreken).
- PDF-miniaturen via de reeds aanwezige PDF-rendering, zonder nieuwe zware afhankelijkheden waar mogelijk.
