# App Store-lancering "BCD leden" (nieuwe versie)

## Advies over listing
Omdat de vorige afwijzing aan jouw Apple Developer-account hangt, heeft een nieuwe app in hetzelfde account geen voordeel. Beter is om de bestaande "Ledenbestand"-listing te gebruiken en deze inzending te positioneren als een volledige vervanging (major update). Dat voorkomt dat je reviews, app-naam en eventuele ranking opnieuw opbouwt.

## Doel
De huidige webapp (BCD Ledenportaal) publiceren als native iOS-app in de App Store, met alle huidige functionaliteit beschikbaar voor geautoriseerde leden. Nieuwe features worden later via updates toegevoegd.

## Stappen

### 1. Capacitor-identiteit en productie-URL
- Wijzig `capacitor.config.ts`:
  - `appName`: `"BCD leden"`
  - `appId`: professionele bundle ID, bijvoorbeeld `nl.bcd.leden`
  - `server.url`: leeg laten voor productiebuild, zodat de app lokaal uit `dist` draait
  - `cleartext`: uitschakelen voor release
- Voeg `androidStudioPath` / Xcode-paden toe indien nodig voor CI.

### 2. iOS-platform toevoegen en voorbereiden
- `npx cap add ios`
- `npx cap sync ios`
- Genereer iOS-app-iconset en launch-screen vanuit `public/app-icon.png` en `public/splash.png`.
- Controleer `Info.plist`:
  - `UIViewControllerBasedStatusBarAppearance`
  - `ITSAppUsesNonExemptEncryption` op `NO`
  - Vereiste permissie-description strings (camera/foto's alleen als uploadfunctie native wordt gebruikt).

### 3. Mobile UI-aanscherping
- Hercontroleer safe-area insets en `overflow-x: hidden` op html/body/#root.
- Verifieer dat sidebars/bottom sheets touch-vriendelijk zijn.
- Test kritieke flows op klein scherm: inloggen, MFA, ledenlijst, agenda, financiën.
- Zorg dat toetsenbord niet over invoervelden heen valt.

### 4. Push-notificaties en native plugins
- Controleer `PushNotificationInit.tsx` en `usePushNotifications.ts` op fouten bij afwezigheid van push-permissie.
- Registreer push-capability in Xcode en APNS-certificaat/Key in Apple Developer Portal.
- Test push-token registratie tegen Supabase/OneSignal indien van toepassing.

### 5. Reviewer testaccount
- Maak in Supabase een demo-account aan (bijv. `reviewer@bcd.demo`) met beperkte rechten.
- Koppel het account aan één fictief testlid met leesrechten.
- Noteer inloggegevens + MFA-setup voor App Store Connect "Demo Account".

### 6. App Store-metadata voorbereiden
- App-naam: "BCD leden"
- Ondertitel: "Ledenportaal Bond van Cannabis Detaillisten"
- Beschrijving (max. 4000 tekens): wat de app doet, voor wie, en dat toegang alleen voor geverifieerde leden is.
- Keywords: ledenportaal, coffeeshop, branchevereniging, cannabis detaillist
- Privacy policy URL (bestaande website of nieuwe pagina).
- Screenshots:
  - iPhone 6.7" (1290 x 2796)
  - iPhone 5.5" (1242 x 2208)
  - iPad 12.9" (2048 x 2732)
- Voorbereid antwoord op Guideline 2.1(b):
  - Doelgroep: geverifieerde coffeeshophouders en bestuursleden van BCD.
  - Geen digitale verkoop in de app; contributie loopt via bankoverschrijving.
  - App biedt toegang tot een bestaand lidmaatschap (reader/ledenportaal-model).
  - Geen betaalde content of in-app aankopen.
  - Accounts zijn gratis maar alleen na handmatige verificatie.

### 7. Build en upload
- Voer `npm run build` uit.
- `npx cap copy ios` en `npx cap open ios`.
- Archive in Xcode met productie signing & provisioning profile.
- Upload via Xcode Organizer of Transporter naar App Store Connect.
- Vul App Store Connect in: versie, build, metadata, demo-account, export compliance.

### 8. Indiening en nazorg
- Dien in voor review.
- Monitor App Store Connect op vragen of afwijzingen.
- Zet na goedkeuring een workflow op voor toekomstige updates: na elke feature-build `npm run build` → `npx cap sync` → nieuwe build uploaden.

## Technische details
- Framework: Capacitor 8 + React 18 + Vite 5.
- Bundle ID: voorstel `nl.bcd.leden` (kan worden aangepast).
- Minimale iOS-versie: iOS 14 of 15, afhankelijk van gebruikte Web APIs.
- Geen in-app purchases; geen advertenties.
- Backend: Lovable Cloud (Supabase) met RLS en MFA verplicht.

## Afhankelijkheden van jou
- Toegang tot Apple Developer Portal en App Store Connect.
- Beschikbaarheid van een Mac met Xcode voor build en upload (of Xcode Cloud inrichten).
- Privacy-policy pagina/URL.
- Goedkeuring van voorgestelde bundle ID en app-naam.