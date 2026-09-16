# Automatisch uitnodigen van nieuwe contactpersonen

Nu gebeurt er niets als je bij een lid een contactpersoon toevoegt: de welkomst-/inlogmail gaat alleen uit bij een nieuw lid of een zelfaanmelding. Dat wordt automatisch.

## Wat er verandert

- Voeg je bij een lid een contactpersoon met e-mailadres toe en sla je op, dan krijgt die persoon direct de inlogmail met stap-voor-stap uitleg (dezelfde mail als nieuwe leden krijgen).
- Het adres wordt tegelijk toegevoegd aan de toegestane inlogadressen van dat lid, zodat de uitnodiging ook echt werkt, en aan de mailinglijst.
- Er gaat nooit twee keer een uitnodiging naar hetzelfde adres: adressen die al eerder zo'n mail kregen of al een account hebben, worden overgeslagen.
- Alleen echt nieuwe adressen tellen mee. Een naam corrigeren, een telefoonnummer wijzigen of een contactpersoon verwijderen stuurt niets.
- Leads krijgen dezelfde mail zonder de inlogstappen, net als nu bij nieuwe leads.
- Wijzigt een lid zelf zijn contactpersonen, dan gaat de uitnodiging pas uit nadat het bestuur de wijziging heeft goedgekeurd.
- Na opslaan zie je kort een melding: "Uitnodiging verstuurd naar ..." of de reden waarom niet.

## Technisch

- Nieuwe helper `src/lib/contactInvites.ts`: vergelijkt oude en nieuwe `contacten` uit de ledendata, geeft de nieuw toegevoegde, geldige e-mailadressen terug (genormaliseerd, ontdubbeld, ook vergeleken met `email`/`email2`/factuuradres van het lid). Met unit-tests in `src/lib/contactInvites.test.ts`.
- Nieuwe helper `sendContactInvites(memberId, member, emails)`: per adres
  1. upsert in `member_allowed_emails` en `member_mailing_preferences` (duplicaten negeren),
  2. check in `email_send_log` op eerdere `member-welcome-steps`/`login-reminder` voor dat adres, en check op bestaand account via `member_profiles`/`auth`-koppeling, anders overslaan,
  3. `send-transactional-email` aanroepen met `templateName: 'member-welcome-steps'`, tekst uit `email_templates` (`member_welcome` / `lead_welcome`, placeholders `{{contactpersoon}}`, `{{coffeeshop}}`, `{{plaats}}`) en `idempotencyKey: contact-invite-<memberId>-<email>`.
- Aanroep vanuit `useSaveMemberEdit` (in `src/hooks/useMemberEdits.ts`), na de succesvolle upsert, met de gemergede oude waarden als vergelijkingsbasis; en vanuit `useApproveEditRequest` voor ledenwijzigingen die via goedkeuring binnenkomen.
- Mails falen zacht: een mislukte uitnodiging blokkeert het opslaan niet, maar wordt als waarschuwing getoond en gelogd.
