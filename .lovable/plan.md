# Build geslaagd — nu archiveren en uploaden

De terminal laat zien dat `npm run build` en `npx cap sync ios` correct zijn afgerond: web assets gekopieerd naar `ios/App/App/public`, `capacitor.config.json` aangemaakt, 3 plugins gevonden (push-notifications, splash-screen, native-biometric). Geen wijzigingen nodig in Lovable.

## Stappen op je Mac

1. Open het project in Xcode:
   ```bash
   open ios/App/App.xcworkspace
   ```
   Gebruik het `.xcworkspace`, niet het `.xcodeproj`.
2. Target **App** → **Signing & Capabilities**:
   - Team: jouw Apple Developer team
   - Bundle Identifier: `nl.bcd.leden`
   - Capability **Push Notifications** aanwezig
3. Zet de device-keuze bovenin op **Any iOS Device (arm64)**.
4. **Product → Archive**.
5. In de Organizer: **Distribute App → App Store Connect → Upload**.

## In App Store Connect

- Nieuwe versie (2.0) aanmaken en de geüploade build koppelen.
- **App Review → Sign-In Information**:
  - Gebruikersnaam: `appstore-reviewer@bcd.review`
  - Wachtwoord: `ReviewBCD2026!`
  - Notitie: besloten ledenportaal voor aangesloten coffeeshops; geen in-app aankopen; contributie via bankoverschrijving; tweestapsverificatie staat uit voor dit reviewaccount.
- Screenshots (iPhone 6.7" verplicht), beschrijving, keywords, privacybeleid-URL.
- Export compliance: `ITSAppUsesNonExemptEncryption` staat al op NO.

## Over de waarschuwingen

Beide zijn onschuldig:
- "chunks larger than 500 kB" — alleen een bundelgrootte-hint van Vite.
- "capacitor-native-biometric does not have a Package.swift" — die plugin gebruikt CocoaPods in plaats van SPM en werkt gewoon.

Als Xcode klaagt over ontbrekende Pods:
```bash
cd ios/App && pod install
```

## Wat ik in Lovable doe

Niets — de configuratie is al App Store-klaar.
