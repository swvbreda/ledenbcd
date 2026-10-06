# Bijlage toevoegen aan "Mail alle deelnemers"

## Wat je krijgt
- In het venster "Mail alle deelnemers" komt onder het bericht een knop **"Bijlage toevoegen"** (bijv. het concept gespreksverslag).
- Toegestaan: PDF, Word, Excel, PowerPoint en afbeeldingen, maximaal 10 MB per bestand, maximaal 3 bestanden.
- Je ziet de gekozen bestanden met naam en grootte, en kunt ze weer weghalen vóór het versturen.
- In de mail staat onder je tekst een duidelijke knop/link per bijlage: **"Download: Concept gespreksverslag.pdf"**.
- De bijlage wordt vastgelegd bij die verzending. "Alleen mislukte opnieuw" en "Verzending hervatten" sturen dus precies dezelfde bijlage mee; een nieuwe bijlage kan alleen via "Nieuw bericht".

## Waarom een downloadlink in plaats van een echt aangehecht bestand
- Grote bijlagen in 25 losse mails vergroten de kans dat mails in spam belanden of geweigerd worden.
- Met een link kan de bijlage veilig en privé blijven: alleen wie de mail heeft, kan het bestand openen, en de link verloopt na 30 dagen.

## Veiligheid
- Bestanden komen in een afgeschermde opslagplek, niet openbaar vindbaar.
- Alleen beheerders kunnen uploaden; de server controleert dat de bijlage bij dit evenement en deze verzending hoort.
- Per ontvanger een persoonlijke, tijdelijke downloadlink.
- Bestandsnamen worden veilig weergegeven in de mail.

## Testen
- Alleen met nagebootste verzending; er worden geen echte mails of testmails verstuurd.
- Controles: typecheck, tests, build. Niet publiceren zonder jouw akkoord.

## Technische details
- Nieuwe private storage bucket `agenda-mail-attachments` (alleen admin-upload via RLS, geen anon).
- Kolom `attachments jsonb` op `agenda_participant_mail_batches` (pad, naam, grootte, type), vastgelegd bij batch-aanmaak; retries lezen de opgeslagen lijst.
- Server function genereert per verzending signed URLs (30 dagen) en geeft ze mee aan template `agenda-participant-message` (nieuwe optionele prop `attachments`).
- Validatie type/grootte zowel in de client als server-side.
