## Biometrische login (Face ID / vingerafdruk) voor Capacitor

### Aanpak
Na de eerste succesvolle login worden de inloggegevens veilig opgeslagen in de device Keychain (iOS) of Keystore (Android). Bij volgende app-opstart kan de gebruiker met Face ID of vingerafdruk inloggen.

### Stappen

1. **Installeer `capacitor-native-biometric` plugin**
   - NPM package toevoegen aan het project

2. **Maak een `useBiometricAuth` hook**
   - Check of biometrie beschikbaar is op het device
   - Sla credentials op na succesvolle login (e-mail + refresh token)
   - Haal credentials op bij biometrische verificatie
   - Verwijder credentials bij uitloggen

3. **Pas de LoginPage aan**
   - Toon een "Inloggen met Face ID / vingerafdruk" knop als er opgeslagen credentials zijn
   - Na eerste login: vraag of de gebruiker biometrie wil activeren

4. **Integratie met bestaande auth flow**
   - Na succesvolle biometrische verificatie: gebruik opgeslagen refresh token om sessie te herstellen
   - MFA-flow blijft intact (biometrie vervangt alleen het wachtwoord-invoer deel)

### Veiligheid
- Credentials worden opgeslagen in de native Keychain/Keystore (hardware-beveiligd)
- Refresh tokens verlopen automatisch
- Bij uitloggen worden opgeslagen credentials gewist
