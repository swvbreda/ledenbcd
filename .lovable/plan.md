# Bevestigingsmail ook bij wijziging en voor bestuursleden

## Hoe het nu werkt

- Een lid dat zich aanmeldt krijgt een bevestigingsmail op het gekozen contactadres.
- Wordt een bestaande aanmelding gewijzigd (aantal personen, naam, opmerking), dan gaat er geen mail.
- Bestuursleden krijgen alleen een Outlook-uitnodiging, geen bevestigingsmail.

## Wat er verandert

### 1. Mail bij wijziging
- Wijzigt het aantal personen, een naam, de opmerking of de contactpersoon, dan gaat er een bijgewerkte bevestiging naar het gekozen adres.
- De mail krijgt bovenaan de regel "Je aanmelding is bijgewerkt" in plaats van "Aanmelding bevestigd", met dezelfde gegevens eronder.
- Verandert er niets inhoudelijks, dan gaat er ook geen mail.
- Onderwerp wordt "Aanmelding bijgewerkt: {titel}".

### 2. Bevestiging voor bestuursleden
- Bestuursleden krijgen naast de Outlook-uitnodiging dezelfde bevestigingsmail, met hun eigen naam in de aanhef.
- Adres: het bondsadres van het bestuurslid, anders het persoonlijke adres uit het bestuursoverzicht.
- Heeft een bestuurslid geen adres, dan gebeurt er niets extra's — de aanmelding blijft gewoon staan.
- Automatisch aangemelde bestuursleden bij wekelijkse bestuursvergaderingen krijgen géén mail; alleen aanmeldingen die iemand zelf doet of die het bestuur handmatig toevoegt.

## Technisch

- `src/hooks/useAgenda.ts`: `sendRegistrationConfirmation` krijgt een `mode` ('new' | 'updated') en kan een bestuurslid-ontvanger oplossen via `board_members` (`bond_email` → `email`). De `register`-mutatie stuurt voortaan ook bij een update, maar alleen wanneer guests/note/namen/contact daadwerkelijk wijzigen (huidige rij eerst ophalen en vergelijken). Idempotency key wordt `agenda-reg-{id}-{new|upd-<hash of changed values>}` zodat een herhaalde klik geen dubbele mail geeft.
- Template `supabase/functions/_shared/transactional-email-templates/agenda-registration-confirmation.tsx`: extra prop `isUpdate`; kop/inleiding en `subject()` passen zich daarop aan.
- De automatische bestuursseeding (`seed_board_registrations` / trigger) verloopt via de database en raakt deze clientcode niet, dus die blijft mailloos.
- Na de wijziging worden de e-mailfuncties opnieuw uitgerold en volgt een typecheck.
