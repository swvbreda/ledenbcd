# Outlook op de achtergrond + uitnodigingen laten aankomen

## Wat je nu ziet
De agenda-afspraken staan wél in de Outlook-agenda van het bondsadres (laatste bijwerking vandaag, zonder fouten) en alle aangemelde personen staan als genodigde geregistreerd. Wat ontbreekt is de uitnodigingsmail in de mailbox van de deelnemer.

## Wat ik ga doen

### 1. Outlook-knop en -symbolen weghalen
- De knop "Outlook bijwerken" en de statusregel ("laatst bijgewerkt om …", foutmelding) verdwijnen uit het deelnemersscherm.
- Het label "In Outlook" achter elke deelnemer verdwijnt ook.
- De synchronisatie blijft precies zoals nu automatisch draaien bij aanmaken, wijzigen, aanmelden en afmelden. Fouten worden alleen nog in de achtergrondlogboeken vastgelegd.

### 2. Uitzoeken waarom de uitnodiging niet aankomt
Ik controleer de afspraak rechtstreeks bij Microsoft (status van de afspraak, of hij als concept staat, en de reactiestatus per genodigde) en de synchronisatielogboeken. Op basis daarvan pas ik de aanroep aan zodat Microsoft de uitnodiging echt verstuurt.

### 3. Zekerheid inbouwen: agenda-uitnodiging in de bevestigingsmail
Ongeacht wat Microsoft doet, krijgt de bevestigingsmail die de deelnemer al ontvangt een echte agenda-uitnodiging als bijlage (in plaats van het huidige losse agendabestand). Daarmee kan de ontvanger het item met één klik in zijn eigen agenda zetten, ook als hij geen Microsoft-account gebruikt. Bij een wijziging of annulering volgt automatisch de bijgewerkte versie.

## Technische details
- `src/components/agenda/AgendaDeelnemersDialog.tsx`: verwijder de `syncOutlook`-knop, het `outlook_error`/`outlook_synced_at`-blok en de `outlook_state`-badges. `useAgendaMutations().syncOutlook` blijft bestaan voor de automatische aanroep vanuit de database-trigger.
- `src/routes/api/public/agenda-outlook-sync.ts`: na PATCH/POST een `GET /users/{mailbox}/events/{id}?$select=isDraft,attendees,responseRequested` doen en het resultaat in `outlook_sync_log.details` opslaan; indien nodig `responseRequested: true` expliciet meesturen en bij een bestaande afspraak nieuwe genodigden via `PATCH` met volledige attendee-lijst zetten zodat Microsoft de update-uitnodiging stuurt.
- `.ics`-bijlage in `supabase/functions/_shared/…/agenda-registration-confirmation` en de verzendfunctie: `METHOD:REQUEST` met organisator, `SEQUENCE` per wijziging en `METHOD:CANCEL` bij annulering.
- Daarna typecheck en de e-mailfuncties opnieuw uitrollen.
