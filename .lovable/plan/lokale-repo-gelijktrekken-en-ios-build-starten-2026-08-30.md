# Lokale repo gelijktrekken en iOS-build starten

Je lokale kopie is een oude versie. Het project in Lovable is leidend en al App Store-klaar.

## Wat er in Lovable staat (bevestigd)
- `capacitor.config.ts`: `appId: 'nl.bcd.leden'`, `appName: 'BCD leden'`, `webDir: 'dist'`
- Geen `server.url` meer (die hoort er voor een release-build niet in)
- De map `ios/App` bestaat in het project

## Stappen op je Mac
1. In GitHub Desktop: **Changes** → rechtsklik op "23 changed files" → **Discard all changes**. Je lokale aanpassing naar `nl.coffeeshopbond.leden` verdwijnt daarmee; die is achterhaald.
2. Klik **Pull origin** (3364 commits) tot de teller op 0 staat.
3. Controleer dat `capacitor.config.ts` nu `nl.bcd.leden` toont.
4. Terminal in de projectmap:
   - `npm install`
   - `npm run build`
   - `npx cap sync ios`
5. `ios/App/App.xcworkspace` openen in Xcode.
6. In Xcode → target **App** → Signing & Capabilities: jouw Apple Developer Team kiezen; Bundle Identifier moet **nl.bcd.leden** zijn.
7. **Product → Archive** → **Distribute App** → App Store Connect → Upload.

## In App Store Connect
- Maak (indien nog niet aanwezig) de app aan met bundle ID `nl.bcd.leden`.
- Vul bij **App Review → Sign-in Information** het reviewer-account in:
  - `appstore-reviewer@bcd.review` / `ReviewBCD2026!` (slaat MFA over)
- Voeg screenshots, beschrijving, privacy-antwoorden en support-URL toe.

## Wat ik in Lovable doe
Niets aan de configuratie: `nl.bcd.leden` blijft staan. Zeg het als je liever `nl.coffeeshopbond.leden` wilt, dan pas ik `capacitor.config.ts` aan vóór je pullt.
