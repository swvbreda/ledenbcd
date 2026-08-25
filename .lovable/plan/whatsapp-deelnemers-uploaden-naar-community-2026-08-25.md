# WhatsApp-deelnemers uploaden naar Community

## Doel
Een uploadknop toevoegen op de **Community deelnemers**-pagina (`/community`) zodat bestuur/admin een CSV-bestand met WhatsApp-community-deelnemers kan importeren in de tabel `whatsapp_participants`.

## Huidige situatie
- De pagina `/community` heeft twee tabs: **Deelnemerslijst** en **Te doen**.
- De lijst leest uit `whatsapp_participants` (kolommen: `display_name`, `phone`, `member_id`, `note`, `sort_key`).
- Er is nog geen enkele import/upload-functionaliteit; deelnemers moeten nu handmatig in de database worden gezet.

## Gewenste oplossing

```text
┌─────────────────────────────────────────────┐
│ Community deelnemers                        │
│                                             │
│  [Upload deelnemerslijst (CSV)]  Zoek...    │
│                                             │
│  Tabel met gekoppelde/niet-gekoppelde        │
│  deelnemers                                  │
└─────────────────────────────────────────────┘
```

### Uploadflow
1. Gebruiker klikt op **"Upload deelnemerslijst (CSV)"**.
2. File picker accepteert alleen `.csv`.
3. CSV wordt client-side geparsed (`display_name`, `phone`, eventueel `member_id`, `note`).
4. Dialoog toont een preview: aantal rijen, nieuwe vs. bestaande telefoonnummers, eventuele parse-fouten.
5. Bij bevestiging: normaliseer telefoonnummers (cijfers +, geen spaties), genereer `sort_key`, en voer **upsert** uit op basis van `phone` (telefoonnummer is de meest stabiele sleutel).
6. Lijst wordt direct ververst; toast met aantal geïmporteerde/bijgewerkte rijen.

### Afhandeling duplicates
- Als `phone` al bestaat → update `display_name`, `note`, `sort_key`, optioneel `member_id`.
- Als `phone` leeg is → altijd een nieuwe rij toevoegen (kan later handmatig gekoppeld worden).
- Lege/ongeldige rijen (geen `display_name`) worden overgeslagen met melding.

## Technische uitwerking

### Bestanden
- `src/components/CommunityDeelnemersLijst.tsx` — toevoegen uploadknop + import-dialoog + parsing.
- `src/components/CommunityUploadDialog.tsx` — nieuwe dialoogcomponent voor preview + bevestiging.
- `src/lib/phoneMatch.ts` — hergebruik telefoonnormalisatie; eventueel een `normalizePhoneForStorage`-helper toevoegen.

### Data
- Insert/upsert rechtstreeks via `supabase.from("whatsapp_participants")` (geen edge function nodig).
- RLS voor `whatsapp_participants` verifiëren en zo nodig een policy toevoegen zodat admin/board kan inserten/updaten.

### CSV-formaat
Verwachte kolommen (case-insensitive, Nederlands/Engels tolerant):
- `Naam` / `display_name` (verplicht)
- `Telefoon` / `Telefoonnummer` / `phone` (aanbevolen)
- `Lidnummer` / `member_id` (optioneel)
- `Notitie` / `note` (optioneel)

## Acceptatiecriteria
- [ ] Op `/community` is een zichtbare **"Upload deelnemerslijst (CSV)"** knop voor admin/board.
- [ ] CSV met minimaal een naamkolom wordt succesvol geïmporteerd.
- [ ] Bestaande deelnemers op basis van telefoonnummer worden bijgewerkt, niet gedupliceerd.
- [ ] Na import verschijnen de nieuwe/bijgewerkte deelnemers direct in de tabel.
- [ ] Foutieve rijen worden niet geïmporteerd en de gebruiker krijgt een heldere melding.
