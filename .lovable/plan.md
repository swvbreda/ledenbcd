## Doel

Bestuur kan één jaarplan-PDF uploaden die alle ingelogde leden kunnen **bekijken** in de app, maar niet kunnen downloaden of (op iOS) screenshotten. Op web wordt screenshotten afgeschrikt met een dynamisch watermerk (naam + e-mail van kijker).

## Belangrijke beperking vooraf

In een browser kan een screenshot **technisch niet geblokkeerd** worden — dat is een platformbeperking, niet iets wat we kunnen fixen. Daarom:
- **iOS-app (Capacitor):** scherm wordt zwart bij screenshot/app-switcher (echte blokkade).
- **Web/Android browser:** dynamisch watermerk over de PDF zodat een screenshot herleidbaar is naar de gebruiker die hem maakte.

Volledige bescherming bestaat niet — een gebruiker kan altijd een foto met z'n telefoon maken. De combinatie afschrikking + audit trail is het maximaal haalbare.

## Wat er gebouwd wordt

### 1. Opslag (backend)
- Nieuwe **private** Supabase storage bucket `secure-documents` (niet-publiek).
- Nieuwe tabel `secure_documents` met één rij voor "jaarplan-actueel" (titel, storage path, geüpload door, datum). Eén-slot model: nieuwe upload vervangt de oude.
- RLS: alleen bestuur kan uploaden/vervangen; alle ingelogde leden kunnen het record lezen (niet het bestand direct).
- Bucket policies: **geen** directe leestoegang. Bestand alleen bereikbaar via signed URL met korte TTL (60 seconden).

### 2. Edge function `get-secure-document-url`
- Verifieert JWT van ingelogde gebruiker.
- Genereert een signed URL (60s TTL) naar de PDF.
- Logt elke aanvraag (wie, wanneer) in een `secure_document_views` tabel — bruikbaar als audit trail bij lekken.

### 3. Beveiligde PDF-viewer (frontend)
Nieuwe pagina `/jaarplan` met een viewer die:
- PDF.js gebruikt om elke pagina naar een `<canvas>` te renderen (geen native browser-PDF-viewer met downloadknop).
- Rechtermuisknop, drag & drop, en toetsen Ctrl/Cmd+S, Ctrl/Cmd+P, PrintScreen blokkeert binnen de viewer.
- **Dynamisch watermerk-overlay** met naam + e-mail van de ingelogde gebruiker, diagonaal herhaald over de pagina, semi-transparant.
- `@media print` CSS verbergt de viewer volledig (afdrukken naar PDF levert een lege pagina).
- Geen "open in nieuw tabblad"-knop; alleen pagina-navigatie en zoom.

### 4. Bestuur-uploadinterface
- Nieuwe sectie op de bestuurspagina (of bestaande beheerpagina): "Jaarplan beheren" met upload-knop, preview van huidige versie en datum laatste update.
- Vervangt het bestaande slot bij nieuwe upload (oude versie wordt uit storage verwijderd).

### 5. iOS-app screenshot-blokkade (Capacitor)
- Plugin `@capacitor-community/privacy-screen` (of vergelijkbaar) installeren.
- Activeer `enable()` wanneer de gebruiker `/jaarplan` opent, `disable()` bij verlaten.
- Effect op iOS: zwart scherm bij screenshot/app-switcher preview. Op Android: `FLAG_SECURE` blokkeert screenshots volledig.
- Vereist `npx cap sync` en nieuwe iOS-build na implementatie.

### 6. Navigatie
- "Jaarplan" als nieuw item in de sidebar voor ingelogde leden.

## Technisch overzicht

```text
[Bestuur upload]
   │
   ▼
┌──────────────────────┐
│ secure-documents     │  ← private bucket
│  (jaarplan.pdf)      │
└──────────────────────┘
   ▲
   │ signed URL (60s)
   │
[Edge function: get-secure-document-url]
   │ verifieert JWT, logt view
   ▲
[Lid opent /jaarplan]
   │
   ▼
[PDF.js canvas viewer]
   + watermerk overlay (naam + email)
   + key/right-click blokkades
   + @media print: display:none
   + (iOS-app) privacy-screen actief
```

## Wat dit NIET doet (eerlijk)

- Voorkomt geen foto met een externe telefoon.
- Voorkomt geen schermopname via externe tooling op desktop.
- Voorkomt niet dat een technisch onderlegde gebruiker via DevTools het canvas exporteert (wel wordt dat afgeschrikt door watermerk).

De combinatie download-blokkade + iOS screenshot-blokkade + watermerk + audit log is het realistisch haalbare maximum binnen Lovable.
