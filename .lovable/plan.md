# Mailinglijst automatisch opschonen

## Wat er misgaat
In de geëxporteerde/gekopieerde adressenlijst staan adressen die je nu handmatig
weghaalt:

- Hetzelfde adres twee keer met een hoofdletterverschil
  (`boerejongens.marcel@…` en `Boerejongens.marcel@…`).
- Eén veld met twee adressen erin, gescheiden door een komma of spaties
  (`deos@xs4all.nl, erikenwina@hotmail.com`) — die wordt door de mail als
  foutief adres gemarkeerd (rood).
- Adressen met extra spaties aan het eind.

In de ledengegevens staan hier 11 zulke regels, waaronder 3 rommelige regels bij
één lid.

## Wat ik ga doen

1. **Lijst automatisch opschonen bij kopiëren/exporteren** — adressen worden
   gesplitst als er meerdere in één veld staan, spaties eraf, hoofdletters
   genegeerd bij het ontdubbelen, en adressen die geen geldig e-mailadres zijn
   worden weggelaten. Je krijgt dus meteen een schone lijst.
2. **Zelfde opschoning bij het aanvinken van adressen** — een adres met een
   komma erin wordt niet meer als één adres opgeslagen.
3. **De bestaande rommelige regels opruimen** — de drie regels bij lid 16
   worden vervangen door de twee losse adressen, en de dubbele
   hoofdletterversies worden samengevoegd tot één regel. Er gaat geen adres
   verloren.
4. **Controleren** — na het opschonen tel ik de lijst opnieuw en check ik dat
   er geen dubbele of samengevoegde adressen meer in zitten.

## Technisch
- `src/components/MailingExportButton.tsx`: `getUniqueEmails` splitst op
  `,` `;` en witruimte, trimt, valideert met een e-mailregex en ontdubbelt op
  lowercase (met behoud van de eerste schrijfwijze).
- `src/components/MailingPreferences.tsx`: normaliseer het adres voor
  insert/delete op `member_mailing_preferences`.
- Data-opschoning van `member_mailing_preferences` via een gerichte SQL-update
  (splitsen van samengestelde waarden, lowercase-ontdubbeling per `member_id`).
