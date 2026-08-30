# Lokale GitHub Desktop wijzigingen afhandelen

## Huidige situatie
- GitHub Desktop toont **3.364 commits achter** op origin.
- Er staan **23 changed files** klaar om gecommit te worden.
- De wijzigingen in `capacitor.config.ts` zijn tegenstrijdig met de leidende configuratie in Lovable:
  - Lokaal wordt `appId` teruggezet naar `app.lovable.d12c81b41bf9487c88575f255db26beb`.
  - Lokaal wordt `appName` teruggezet naar `ledenbcd`.
  - Lokaal wordt een `server.url` toegevoegd die in Lovable juist is verwijderd.
- In Lovable staat de juiste release-configuratie: `appId: 'nl.bcd.leden'`, `appName: 'BCD leden'`, geen `server.url`.

## Wat je moet doen
1. **Niet committen** in GitHub Desktop.
2. Klik op **Repository → Discard all changes** (of per bestand: rechtsklik → Discard changes).
3. Klik daarna op **Fetch origin** en vervolgens **Pull origin**.
4. Controleer na de pull of `capacitor.config.ts` overeenkomt met Lovable: `appId: 'nl.bcd.leden'` en geen `server.url`.
5. Open een terminal in de projectmap en draai:
   ```bash
   npm install
   npm run build
   npx cap sync ios
   ```
6. Open daarna `ios/App/App.xcodeproj` in Xcode en bouw via **Product → Archive**.

## Waarom dit de juiste route is
- Lovable is de bron van waarheid voor de webbuild en Capacitor-configuratie.
- De lokale wijzigingen lijken afkomstig van een oudere checkout of handmatige aanpassingen die nu conflicteren met de gekoppelde repo.
- Door te discarden en te pullen voorkom je dat de correcte configuratie wordt overschreven.
