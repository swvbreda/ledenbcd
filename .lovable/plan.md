## Plan: Dubbele verificatie (TOTP/Authenticator App)

### Stap 1: MFA Inschrijving
- Nieuwe pagina `/mfa-setup` waar gebruikers een QR-code zien en scannen met hun authenticator app (Google Authenticator, Authy, etc.)
- Na het scannen voeren ze een verificatiecode in om te bevestigen

### Stap 2: MFA Verificatie bij inloggen
- Na succesvol inloggen met e-mail/wachtwoord checkt het systeem of MFA is ingeschakeld
- Als MFA actief is → doorsturen naar een verificatiepagina waar ze de 6-cijferige code invoeren
- Als MFA nog niet is ingesteld → doorsturen naar de inschrijfpagina

### Stap 3: Login flow aanpassen
- `useAuth` hook uitbreiden om MFA-status te detecteren
- Na login checken of de gebruiker nog een TOTP-challenge moet voltooien
- Gebruikers zonder MFA-inschrijving worden verplicht om dit eerst in te stellen

### Stap 4: Account beheer
- Op de "Mijn Account" pagina een sectie toevoegen om MFA te beheren (opnieuw instellen, etc.)

### Technisch
- Gebruikt de ingebouwde Supabase MFA API (`supabase.auth.mfa`)
- Geen extra database tabellen nodig
- QR-code wordt gegenereerd via de Supabase SDK (TOTP URI)
