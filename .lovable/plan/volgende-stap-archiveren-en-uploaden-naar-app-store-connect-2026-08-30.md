# Volgende stap: archiveren en uploaden naar App Store Connect

De build en `npx cap sync ios` zijn lokaal geslaagd (web assets gekopieerd, 3 Capacitor-plugins gevonden, sync klaar). Er zijn geen wijzigingen nodig in Lovable.

## Wat jij nu doet op de Mac

1. Open het Xcode-project:
   ```bash
   open ios/App/App.xcworkspace
   ```
   (gebruik het `.xcworkspace`, niet het `.xcodeproj`)
2. Selecteer target **App** → tab **Signing & Capabilities**:
   - Team: jouw Apple Developer team
   - Bundle Identifier: `nl.bcd.leden`
   - Capability **Push Notifications** aanwezig
3. Bovenin device-keuze op **Any iOS Device (arm64)** zetten.
4. **Product → Archive**.
5. In de Organizer: **Distribute App → App Store Connect → Upload**.

## In App Store Connect

- Versie/build koppelen aan de nieuwe upload.
- Bij **App Review Information → Sign-In Information**:
  - Gebruikersnaam: `appstore-reviewer@bcd.review`
  - Wachtwoord: `ReviewBCD2026!`
  - Notitie: ledenportaal voor aangesloten coffeeshops; geen in-app aankopen; tweestapsverificatie is uitgeschakeld voor dit reviewaccount.
- Screenshots (6.7" iPhone verplicht), beschrijving, privacybeleid-URL invullen.

## Technisch

De waarschuwingen in je terminal zijn onschuldig:
- "chunks larger than 500 kB" = alleen een bundelgrootte-hint.
- "capacitor-native-biometric does not have a Package.swift" = plugin gebruikt CocoaPods in plaats van SPM; werkt gewoon.

Als Xcode klaagt over ontbrekende Pods, draai eerst:
```bash
cd ios/App && pod install
```
