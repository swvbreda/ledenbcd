# GitHub is gekoppeld — nu de iOS-build

De repo `swvbreda/ledenbcd` (branch `main`) staat op **Connected**. De code synct nu twee kanten op. Vanaf hier kun je bouwen.

## Route A — Xcode Cloud (geen eigen Mac nodig)
1. App Store Connect → app **BCD leden** met bundle ID `nl.bcd.leden` (aanmaken als die er nog niet is).
2. Tabblad **Xcode Cloud** → **Connect repository** → autoriseer GitHub → kies `swvbreda/ledenbcd`, branch `main`.
3. Workflow "Build & Archive iOS":
   - Start condition: branch changes op `main` (of handmatig)
   - Environment: laatste Xcode + macOS
   - Action: **Archive**, scheme `App`, platform iOS
   - Post-action: **TestFlight Internal Testing**
4. Belangrijk: Xcode Cloud draait geen `npm run build` uit zichzelf. Voeg in de repo een custom build script toe zodat de webbuild klaarstaat vóór het archiveren:
   `ci_scripts/ci_post_clone.sh` met `npm ci`, `npm run build`, `npx cap sync ios`.
5. Start de eerste build en volg de log.

## Route B — eigen Mac
1. `git clone https://github.com/swvbreda/ledenbcd.git`
2. `npm install` → `npm run build` → `npx cap sync ios`
3. `ios/App/App.xcworkspace` openen in Xcode.
4. Target **App** → Signing & Capabilities → jouw Team; bundle ID `nl.bcd.leden`; capability **Push Notifications** aanzetten.
5. **Product → Archive** → Distribute App → App Store Connect → Upload.

## App Store Connect invullen
- Versie 2.0, beschrijving/keywords bijwerken naar het huidige ledenportaal.
- App Review → Sign-in Information: `appstore-reviewer@bcd.review` / `ReviewBCD2026!` (slaat MFA over).
- Reviewer-notitie: besloten ledenportaal, geen in-app aankopen, contributie via bankoverschrijving.
- Screenshots: iPhone 6.7" en (indien iPad ondersteund) iPad 12.9".
- Export compliance: `ITSAppUsesNonExemptEncryption` staat al op NO.

## Wat ik in Lovable kan doen
Alleen als je Route A kiest: het `ci_scripts/ci_post_clone.sh` script aanmaken en committen, zodat Xcode Cloud de webbuild correct genereert. Verder zijn er geen codewijzigingen nodig.

## Afhankelijk van jou
- Apple Developer / App Store Connect-toegang.
- Keuze tussen Route A en Route B.
