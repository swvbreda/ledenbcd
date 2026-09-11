# Outlook-melding bij deelnemers oplossen

De melding klopt: op de app-registratie "BCD Ledenbestand Sync" staan wel Contacts.ReadWrite, Organization.Read.All en User.Read.All, maar **Calendars.ReadWrite ontbreekt**. Zonder dat recht mag onze koppeling niets in de agenda schrijven, dus elke poging wordt geweigerd.

## Wat jij (of iemand met beheerrechten) moet doen

1. Ga in Microsoft Entra naar dezelfde app-registratie **BCD Ledenbestand Sync** → **API permissions**.
2. **Add a permission** → **Microsoft Graph** → **Application permissions**.
3. Zoek **Calendars.ReadWrite**, vink aan, **Add permissions**.
4. Klik **Grant admin consent for Bond van Cannabis Detaillisten** en controleer het groene vinkje.

Daarna druk ik één keer op "Outlook bijwerken" en zet ik het evenement met deelnemers in de agenda.

## Wat ik in de app aanpas

- De rode foutmelding blijft nu staan, ook als het intussen goed gaat. Ik laat de melding automatisch verdwijnen zodra een synchronisatie slaagt, en toon in plaats daarvan "Laatst bijgewerkt om ...".
- De tekst wordt korter en duidelijker: "Outlook-agenda geeft nog geen toestemming — de beheerder moet dit eenmalig goedkeuren."
- Ik voeg een controle toe zodat de melding alleen aan het bestuur wordt getoond, niet aan gewone leden.

## Technisch

- `src/components/agenda/AgendaDeelnemersDialog.tsx`: foutblok alleen tonen wanneer `outlook_error` gevuld is én er geen recentere `outlook_synced_at` is; anders status "Laatst bijgewerkt".
- `src/routes/api/public/agenda-outlook-sync.ts`: bij een geslaagde run wordt `outlook_error` al op `null` gezet; bij de 403-tekst een kortere gebruikersmelding opslaan (volledige Graph-fout blijft in `outlook_sync_log`).
- Geen databasewijzigingen nodig. De eerder toegevoegde beperking op de aanmeldingen-trigger (geen eindeloze herhaling) blijft ongewijzigd.
