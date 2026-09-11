# Juiste contactpersoon in mails + naam kiezen bij aanmelden

## 1. "Beste Rick" bij Boere Jongens

Bij Boere Jongens staat naast de contactpersonenlijst nog een los, ouder veld "contactpersoon" met de waarde **Rick Bakker**. De contactpersonenlijst bevat alleen Sander Roos en Marcel Moria. De mails gebruiken dat losse veld voor de aanhef, dus blijft "Beste Rick" staan hoewel Rick verwijderd is.

Wat ik doe:
- Het losse contactpersoon-veld van Boere Jongens gelijktrekken met de eerste actieve contactpersoon.
- Bij opslaan van een lid wordt dit veld voortaan altijd afgeleid van de contactpersonenlijst; is de lijst leeg, dan wordt het veld leeggemaakt in plaats van de oude naam te behouden.
- Bij het versturen van mails wordt de aanhef bepaald aan de hand van de contactpersoon die bij het gebruikte e-mailadres hoort; is er geen naam, dan "Beste lid".
- Ik controleer daarna alle leden op zulke verweesde namen en trek die recht.

## 2. Bevestiging bij aanmelden gaat naar de juiste persoon

Nu gaat de bevestiging naar álle bij het lid bekende e-mailadressen (bij Boere Jongens vier stuks), en bij leden zonder geregistreerd adres naar niemand.

Nieuw:
- **Bij aanmelden kies je een naam.** In het aanmeldvenster staat een keuzelijst met de contactpersonen van de coffeeshop (naam + e-mailadres). Standaard staat de persoon die is aangemeld/ingelogd voorgeselecteerd.
- Staat de juiste persoon er niet tussen? Dan kun je naam en e-mailadres handmatig invullen.
- De bevestigingsmail gaat naar die ene gekozen persoon, met zijn naam in de aanhef en in de deelnemerslijst.
- Bestuur kan in het Deelnemers-venster hetzelfde doen: eerst de coffeeshop kiezen, daarna de contactpersoon.
- Leden zien alleen hun eigen coffeeshop en kunnen alleen zichzelf aanmelden; ze kunnen dus alleen kiezen uit de contactpersonen van hun eigen lid.
- Heeft een contactpersoon geen e-mailadres, dan meldt het venster dat direct ("geen e-mailadres bekend — vul er een in") in plaats van stil niets te versturen.

## Technisch

- Data: eenmalige correctie van `contactpersoon` bij lid 9 en overige leden waar die naam niet meer in `contacten` voorkomt (via `member_edits`/`members_data`, fetch-and-merge, geen andere velden aanraken).
- `src/components/MemberEditForm.tsx`: `contactpersoon`/`functie`/`telefoon`/`email` niet meer terugvallen op de oude waarde als de contactenlijst leeg is.
- `src/hooks/useAgenda.ts`: `register` krijgt `contact_name` en `contact_email`; `sendRegistrationConfirmation` gebruikt dat adres (en die naam in `recipientName`) in plaats van alle `member_allowed_emails`; zonder adres wordt `emailed:false` teruggegeven met reden.
- Migratie: kolommen `contact_name text` en `contact_email text` op `agenda_registrations` (nullable) plus GRANT-controle; naam tonen in deelnemerslijst en meesturen naar Outlook-sync (`src/routes/api/public/agenda-outlook-sync.ts` gebruikt dan het gekozen adres als genodigde).
- `src/components/agenda/AgendaRegistrationDialog.tsx` en `AgendaDeelnemersDialog.tsx`: contactpersoon-keuzelijst met vrije invoer; leden zien alleen hun eigen lid.
- `AgendaAnnounceDialog.tsx`/`BulkEmailSend.tsx`: aanhef koppelen aan het contact bij het adres, niet aan het losse veld.

## Controle achteraf

Testaanmelding op een agenda-item bij Boere Jongens: bevestiging komt alleen bij de gekozen contactpersoon aan, met de juiste aanhef.
