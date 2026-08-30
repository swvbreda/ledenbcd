# Archive staat grijs: verkeerd venster open in Xcode

In je screenshot is **Product → Archive** grijs en staat er nog `.env` in de editor. Dat komt doordat Xcode de **map** `ledenbcd-clean` heeft geopend als losse bestanden, niet het iOS-project. Zonder scheme/target kan Xcode niet archiveren. Ook staat er nog "Pull origin 12" — je lokale kopie loopt achter.

## Stappen op je Mac

1. Xcode volledig afsluiten (Cmd+Q).
2. Terminal openen in de projectmap en eerst bijwerken + bouwen:
   ```bash
   cd ~/…/ledenbcd-clean
   git pull
   npm install
   npm run build
   npx cap sync ios
   ```
3. Daarna het juiste project openen:
   ```bash
   open ios/App/App.xcworkspace
   ```
   Links in de navigator moet nu een blauw **App**-project staan (met `Pods`), niet een lijst met `tailwind.config.ts`, `.env` enz.
4. Bovenin, links van de zoekbalk, moet het scheme **App** staan. Zet het apparaat op **Any iOS Device (arm64)**.
5. Target **App** → **Signing & Capabilities**: jouw Team, bundle ID `nl.bcd.leden`, capability **Push Notifications**.
6. **Product → Archive** is nu niet meer grijs.
7. Na de archive: **Distribute App → App Store Connect → Upload**.

## In App Store Connect

- Nieuwe versie aanmaken en de build koppelen.
- App Review Information → testaccount:
  - E-mail: `appstore-reviewer@bcd.review`
  - Wachtwoord: `ReviewBCD2026!`
  - Notitie: besloten ledenapp voor de branchevereniging; inloggen met bovenstaand testaccount.

## Als het misgaat

Stuur de exacte foutmelding (Pods, signing, provisioning profile), dan los ik die stap gericht op. Er zijn geen wijzigingen nodig in de Lovable-code.
