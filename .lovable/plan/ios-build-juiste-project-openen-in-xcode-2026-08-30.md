# iOS-build: juiste project openen in Xcode

Je hebt in Xcode nog steeds het bestand `.env` open. Dat is geen iOS-project en hoef je niet aan te raken (de waarden staan correct). Er zijn geen wijzigingen nodig in Lovable.

## Stappen op je Mac

1. Sluit het huidige venster in Xcode.
2. Open een terminal in de projectmap `ledenbcd-clean` en run:
   ```bash
   open ios/App/App.xcworkspace
   ```
   (Dus niet `.xcodeproj` en niet `.env`.)
3. In Xcode: selecteer links het project **App** → target **App** → tab **Signing & Capabilities**.
   - Team: jouw Apple Developer team
   - Bundle Identifier: `nl.bcd.leden`
   - Capability toevoegen: **Push Notifications**
4. Bovenin het apparaatmenu kiezen: **Any iOS Device (arm64)**.
5. **Product → Archive**.
6. Na de archive: **Distribute App → App Store Connect → Upload**.

## In App Store Connect

- Nieuwe versie aanmaken en de geüploade build koppelen.
- Reviewer-account in "App Review Information":
  - E-mail: `appstore-reviewer@bcd.review`
  - Wachtwoord: `ReviewBCD2026!`
  - Notitie: besloten ledenapp voor de branchevereniging; inloggen met bovenstaand testaccount.

## Als het misgaat

Meld de exacte foutmelding (bijv. over Pods, signing of provisioning profiles), dan los ik die stap gericht op.
