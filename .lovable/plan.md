
# WhatsApp-nummer matcher

Een tool voor admins op de Ledenbestand-pagina om te controleren welk telefoonnummer bij welk lid hoort, en om een hele WhatsApp-deelnemerslijst in één keer te matchen tegen de ledenadministratie.

## Waar het komt

Een extra tab **"WhatsApp-match"** op `LedenPage` (naast Leden / Leads / Coffeeshops). Alleen zichtbaar voor admins. Geen database-wijzigingen nodig — alles draait op de bestaande `members_data` die de pagina al inlaadt.

## Wat het doet

### 1. Single lookup
- Inputveld waar je één telefoonnummer plakt (in elk formaat: `+31 6 12345678`, `0612345678`, `06-12345678`, etc.).
- Direct resultaat: welk lid (coffeeshop + plaats), welke contactpersoon, welke rol (hoofdcontact of contactpersoon uit `contacten[]`). Klik door naar het lid.
- Als geen match: duidelijke "onbekend nummer" melding.

### 2. Bulk-match
- Groot tekstveld waarin je de WhatsApp-deelnemerslijst plakt (één nummer per regel, of de ruwe export waar de tool zelf nummers uit pikt via regex).
- Output in drie groepen:
  - **✅ Gematcht** — nummer → lid + contactpersoon (klikbaar naar lidpagina).
  - **❓ Onbekend** — nummer staat in WhatsApp maar niet in ledenadministratie. Kopieerbaar lijstje zodat je ze kunt onderzoeken of verwijderen.
  - **⚠️ Ontbreekt in WhatsApp** — leden waarvan geen enkel telefoonnummer in de geplakte lijst voorkomt. Zo zie je wie nog uitgenodigd moet worden.
- Knop "Exporteer als CSV" voor het hele rapport.

## Matching-logica

Bron-nummers per lid:
- `member.telefoon` (hoofdnummer) → gelabeld als "hoofdcontact"
- Alle `member.contacten[].telefoon` → gelabeld met `contact.naam` + `contact.functie`

Normalisatie (zelfde functie voor beide kanten van de match):
- Alle niet-cijfers strippen
- Nederlandse normalisatie: `06...` → `316...`, `+31 6...` → `316...`, leading `0031` → `31`
- Vergelijk op laatste 9 cijfers (vangt verschillen in landcode/spaties op)

Een lid kan dus meerdere nummers hebben; één nummer matcht maximaal één (lid, contact)-combinatie.

## Toegang

Tab en functionaliteit alleen tonen als `useAuth().isAdmin === true`. Geen backend-wijziging nodig: de matching gebeurt client-side op de data die admins al mogen zien.

## Technische details

Nieuwe bestanden:
- `src/lib/phoneMatch.ts` — `normalizePhone(raw: string): string | null` en `extractPhones(text: string): string[]` (regex die `(\+?\d[\d\s\-()]{7,}\d)` matcht en daarna normaliseert). Plus `buildPhoneIndex(members)` die een `Map<normalized, {memberId, contactNaam, contactRol}[]>` opbouwt.
- `src/components/WhatsAppMatcher.tsx` — UI-component met twee subviews (single / bulk) via een interne tab of segmented control. Gebruikt `useMembersData()` voor `rawMembers` en `rawLeads`. Hergebruikt bestaande shadcn `Tabs`, `Input`, `Textarea`, `Button`, `Card`.

Gewijzigde bestanden:
- `src/pages/LedenPage.tsx` — extra `TabsTrigger value="whatsapp"` (alleen als `isAdmin`), rendert `<WhatsAppMatcher />`. `ViewTab` type uitgebreid met `"whatsapp"`.

Geen migraties, geen edge functions, geen RLS-wijzigingen. Geen persistente opslag van geplakte nummers — alles blijft in browsergeheugen voor de sessie.

## Niet in scope (kunnen later)

- Automatisch synchroniseren met de WhatsApp Business API (kan in vervolg-iteratie als je een WhatsApp Business-account hebt).
- Permanente opslag van "WhatsApp lid: ja/nee" per lid (vraagt schemawijziging — eerst ervaring opdoen met de matcher).
