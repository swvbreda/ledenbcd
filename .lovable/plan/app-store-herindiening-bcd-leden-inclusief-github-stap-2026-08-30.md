# App Store-herindiening "BCD leden" — inclusief GitHub-stap

## Vraag: moet de code eerst naar GitHub?
Nee, niet verplicht. De iOS-map staat al in het project en een App Store-build kan lokaal in Xcode. Maar GitHub koppelen is wél verstandig:
- Backup van alle code (inclusief de nieuwe `ios/` map en Capacitor-config).
- Nodig als je zonder eigen Mac wilt bouwen via **Xcode Cloud** (leest uit een GitHub-repo).

## Stappen

### 1. GitHub koppelen (nieuw, aanbevolen)
- In Lovable: Plus (+) menu → GitHub → Connect project → autoriseer de Lovable GitHub App → Create Repository.
- Controleer daarna op GitHub dat de repo de `ios/` map en `capacitor.config.ts` bevat.
- Vanaf nu synct elke wijziging automatisch twee kanten op.

### 2. Capacitor-config controleren (al gedaan)
- `appId: nl.bcd.leden`, `appName: BCD leden`, iOS-platform toegevoegd, Info.plist bevat privacy-strings en `ITSAppUsesNonExemptEncryption = NO`.

### 3. Reviewer-account (al gedaan en getest)
- E-mail: `appstore-reviewer@bcd.review`, wachtwoord: `ReviewBCD2026!`
- MFA wordt overgeslagen via `is_reviewer` flag; landt direct op dashboard.
- Deze gegevens invullen in App Store Connect bij "App Review Information → Sign-in required".

### 4. Build en upload
**Optie A — met eigen Mac:**
- Repo clonen (of via Download codebase) → `npm install` → `npm run build` → `npx cap sync ios` → open `ios/App/App.xcodeproj` → Product → Archive → upload naar App Store Connect.

**Optie B — zonder Mac (Xcode Cloud):**
- Vereist stap 1 (GitHub). In App Store Connect → Xcode Cloud → koppel de repo → workflow aanmaken → build starten.

### 5. App Store Connect invullen
- Versie 2.0 (major update, bestaande listing behouden).
- Beschrijving, keywords en privacy-URL bijwerken naar de huidige app.
- Demo-account uit stap 3 invullen + notitie dat het een besloten ledenportaal is (reader-model, geen in-app aankopen).
- Antwoorden uit het eerdere 2.1(b)-plan klaarhouden.

### 6. Indienen en nazorg
- Dien in voor review en monitor App Review-berichten.
- Bij vragen over het verdienmodel: verwijzen naar contributie via bankoverschrijving buiten de app om.

## Technische details
- Capacitor 8 + React 18 + Vite 5, iOS 15 minimum.
- GitHub sync is twee-richtings: pushen naar GitHub synct terug naar Lovable.
- Geen codewijzigingen meer nodig; alles is al gebouwd en getest.

## Afhankelijk van jou
- GitHub-account autoriseren (stap 1).
- Apple Developer / App Store Connect-toegang.
- Keuze: eigen Mac (A) of Xcode Cloud (B).
