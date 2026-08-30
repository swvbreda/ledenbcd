# GitHub koppelen voor App Store / Xcode Cloud

## Doel
Het Lovable-project koppelen aan een GitHub-repository, zodat:
- De code een back-up heeft buiten Lovable.
- Xcode Cloud in App Store Connect rechtstreeks uit de repo kan bouwen (handig als je geen eigen Mac hebt).
- Je later lokaal kunt werken met `git pull`/`git push` en wijzigingen tweezijdig synchroniseren.

## Stappen

### 1. GitHub-koppeling starten in Lovable
1. Open het Lovable-project in de editor.
2. Klik op het **Plus (+) menu** linksonder in de chat-input.
3. Kies **GitHub → Connect project**.
4. Autoriseer de **Lovable GitHub App** in het venster dat opent.
5. Kies het GitHub-account of de organisatie waarin de repository moet komen.
6. Klik op **Create Repository**.

### 2. Controleer de repository
- Wacht tot de eerste sync klaar is.
- Open de repository op GitHub en controleer dat deze bestanden mappen bevat:
  - `capacitor.config.ts`
  - `ios/App/...` (de iOS-map)
  - `src/...`
- Vanaf nu wordt elke wijziging in Lovable automatisch naar GitHub gepusht, en omgekeerd.

### 3. Koppelen aan Xcode Cloud (optioneel, maar dit is de reden voor de koppeling)
1. Ga naar **App Store Connect** → selecteer de app **BCD leden** (of maak deze met bundle ID `nl.bcd.leden`).
2. Open het tabblad **Xcode Cloud**.
3. Kies **Connect repository** en selecteer de net aangemaakte GitHub-repo.
4. Maak een workflow aan (bijvoorbeeld "Build & Archive iOS").
5. Start een eerste build.

### 4. Lokale build (als je wel een Mac gebruikt)
Als je lokaal in Xcode bouwt, hoef je Xcode Cloud niet te gebruiken:
1. Clone de repository van GitHub naar je Mac.
2. Run `npm install`.
3. Run `npm run build`.
4. Run `npx cap sync ios`.
5. Open `ios/App/App.xcworkspace` in Xcode.
6. Kies **Product → Archive** en upload naar App Store Connect.

## Belangrijke details
- **Geen code-wijzigingen nodig** in Lovable voor deze stap.
- De bundle ID blijft `nl.bcd.leden` (al ingesteld in `capacitor.config.ts`).
- Voor App Review gebruik je het reviewer-account: `appstore-reviewer@bcd.review` / `ReviewBCD2026!`.

## Afhankelijk van jou
- Een GitHub-account.
- Toestemming om de Lovable GitHub App te autoriseren.
- (Voor Xcode Cloud) Toegang tot App Store Connect en de juiste teamrechten.
