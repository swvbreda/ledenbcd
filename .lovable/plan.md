# Evenement annuleren bij te weinig animo

Als beheerder kun je een evenement annuleren in plaats van het te verwijderen. Het item blijft zichtbaar in de agenda, duidelijk gemarkeerd als geannuleerd, en aangemelde deelnemers krijgen bericht.

## Wat je krijgt

**Annuleren (beheer)**
- Nieuwe knop **Evenement annuleren** op de agendakaart, naast Deelnemers en Aankondiging versturen.
- In het venster: een korte reden (bijv. "te weinig aanmeldingen"), zichtbaar voor leden, plus een aankruisvakje **Aangemelde deelnemers per e-mail informeren** (standaard aan).
- Overzicht van hoeveel mensen zijn aangemeld, zodat je weet wie je bericht stuurt.
- Een geannuleerd evenement kan met één klik weer **Annulering ongedaan maken**.

**Hoe het eruitziet voor leden**
- Rood label **Geannuleerd** bij de titel, de reden eronder.
- Aanmelden en wijzigen zijn niet meer mogelijk; bestaande aanmeldingen blijven bewaard (afmelden kan nog wel).
- De deelknop en de openbare uitnodigingspagina (`/a/CODE`) tonen ook dat het evenement is geannuleerd.
- Op het dashboard krijgt het item hetzelfde label.

**E-mail**
- Aangemelde leden krijgen een bericht met titel, oorspronkelijke datum/tijd en de opgegeven reden.

## Technisch

Database (migratie op `agenda_events`):
- `cancelled_at timestamptz`, `cancel_reason text`, `cancelled_by uuid` — alleen admins kunnen deze velden zetten (bestaand schrijfbeleid volstaat).
- Capaciteits-/aanmeldtrigger uitbreiden: insert/update op `agenda_registrations` blokkeren zolang het event `cancelled_at` heeft.
- `get_agenda_share` uitbreiden met `cancelled_at` en `cancel_reason` voor de openbare preview.

Frontend:
- `src/hooks/useAgenda.ts`: velden toevoegen aan `AgendaEvent`, plus mutatie `cancelEvent` / `uncancelEvent` en een `sendCancellationEmails`-helper naar het patroon van `sendRegistrationConfirmation`.
- Nieuw `src/components/agenda/AgendaCancelDialog.tsx` (reden + mailoptie).
- `AgendaEventCard.tsx`: badge, reden, knoppen, aanmelden uitschakelen bij annulering.
- `AgendaDashboardCard.tsx` en `src/routes/a.$shareCode.tsx` + `src/lib/agendaShare.functions.ts`: geannuleerd tonen.
- Nieuw e-mailsjabloon `supabase/functions/_shared/transactional-email-templates/agenda-event-cancelled.tsx` + registratie in `registry.ts`; idempotency key `agenda-cancel-{event_id}-{email}`.
