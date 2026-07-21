## Probleem

Het aanmeldformulier op coffeeshopbond.nl schrijft naar `public.membership_requests`, maar in de database staat nu:
- RLS aan
- **Geen enkele policy**
- **Geen GRANTs** voor `anon`, `authenticated` of `service_role`

Zonder policy én zonder GRANT weigert PostgREST elke anonieme insert stil. Daardoor komt er niets binnen, worden de triggers (auto-lid aanmaken + notificatiemail) niet geactiveerd, en krijg jij geen bericht.

## Fix (één migratie)

1. `GRANT INSERT ON public.membership_requests TO anon` — zodat het publieke formulier mag insereren.
2. `GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_requests TO authenticated` — voor het beheerdersportaal.
3. `GRANT ALL ON public.membership_requests TO service_role` — voor edge functions en triggers.
4. Policies opnieuw aanmaken:
   - `INSERT` policy `USING (true)` voor `anon` en `authenticated` (iedereen mag zich aanmelden).
   - `SELECT / UPDATE` policy voor admins/board via `has_role` / `is_board_member`, zodat alleen bevoegden aanvragen kunnen inzien en beheren.
5. Controleren dat de bestaande triggers (`auto_create_member_from_request` BEFORE INSERT en `notify_on_membership_request` AFTER INSERT) nog aan staan; zo niet, opnieuw aanhaken.

## Verificatie na migratie

- Query `information_schema.role_table_grants` om te bevestigen dat `anon` INSERT heeft.
- Test-insert via anon key (zoals het publieke formulier doet) om te zien of hij landt en of de triggers vuren.
- Controleer of er meteen een rij in `members_data` verschijnt en of `notify-membership-request` een mail heeft verstuurd (`email_send_log`).

## Buiten scope

- Geen aanpassing aan het formulier zelf op coffeeshopbond.nl — dat is een aparte site en gebruikt de anon key correct zodra GRANTs en policies kloppen.
- Geen wijziging aan het bevestigingsmail-domein (aparte openstaande taak: `notify.leden.coffeeshopbond.nl` DNS).
