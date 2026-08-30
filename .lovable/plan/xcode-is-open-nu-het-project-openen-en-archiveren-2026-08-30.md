# Xcode is open — nu het project openen en archiveren

Je ziet het welkomstscherm van Xcode 26.6. Kies **Open Existing Project...** (niet "Clone Git Repository", je hebt de code al lokaal).

## Stappen

1. **Open Existing Project...** → navigeer naar je projectmap `ledenbcd-clean` → `ios` → `App` → selecteer **`App.xcworkspace`** (het witte/blauwe workspace-icoon, niet `App.xcodeproj`) → Open.
   Sneller kan ook via de terminal in de projectmap:
   ```bash
   open ios/App/App.xcworkspace
   ```
2. Wacht tot Xcode klaar is met indexeren (voortgangsbalk bovenin).
3. Klik links in de projectnavigator op **App** → target **App** → tab **Signing & Capabilities**:
   - Vink **Automatically manage signing** aan
   - Team: jouw Apple Developer team
   - Bundle Identifier: `nl.bcd.leden`
   - Controleer of **Push Notifications** als capability staat (zo niet: **+ Capability** → Push Notifications)
4. Bovenin bij de device-kiezer: **Any iOS Device (arm64)** selecteren. Archive is niet beschikbaar zolang er een simulator geselecteerd staat.
5. Menu **Product → Archive**. Dit duurt een paar minuten.
6. In het Organizer-venster dat opent: **Distribute App → App Store Connect → Upload**.

## Als er iets misgaat

- Foutmelding over ontbrekende Pods of `Podfile`:
  ```bash
  cd ios/App && pod install
  ```
  daarna opnieuw `App.xcworkspace` openen.
- "No account for team" → Xcode → Settings → Accounts → Apple ID toevoegen.
- "Archive" grijs → je staat nog op een simulator; zet om naar Any iOS Device.

## Daarna in App Store Connect

- Versie 2.0 aanmaken en de build koppelen.
- App Review → Sign-In Information: `appstore-reviewer@bcd.review` / `ReviewBCD2026!`, met notitie dat het een besloten ledenportaal is zonder in-app aankopen.
- Screenshots (iPhone 6.7"), beschrijving, keywords, privacybeleid-URL.

## In Lovable

Geen codewijzigingen nodig — `capacitor.config.ts` staat al op `nl.bcd.leden` / `BCD leden`, en de Info.plist bevat de privacy-strings en `ITSAppUsesNonExemptEncryption = NO`.
