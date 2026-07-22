# Aanmeldflow verifiëren en opschonen

## Wat ik vond bij het nakijken

- Trigger `before_insert_membership_request_autocreate` staat aan → maakt automatisch een lid in `members_data` aan bij een nieuwe aanvraag.
- Anonieme bezoekers mogen `INSERT` doen op `membership_requests` (RLS-policy "Anyone can submit a request" — actief).
- Laatste lid in `members_data` is **#138 Huzur 33**. Eerder was er ook een #139 na een testaanmelding; die staat er nu niet meer. Kan handmatig verwijderd zijn.
- `membership_requests` is momenteel leeg (0 rijen). Dat is normaal als je aanvragen na verwerking opschoont, maar het betekent ook dat ik uit de tabel alleen niet kan bewijzen dat het nu nog werkt.
- **Twee identieke notificatie-triggers** staan op `membership_requests`:
  - `after_insert_membership_request_notify`
  - `trg_notify_on_membership_request`
  
  Beide roepen dezelfde functie `notify_on_membership_request()` aan. Elke nieuwe aanmelding stuurt dus nu **twee** mails naar het secretariaat en twee bevestigingen naar de aanmelder.
- Twee dubbele INSERT-policies ("Anyone can submit a request" + "Anyone can submit membership request"): functioneel geen probleem, maar rommelig.

## Wat ik ga doen

### 1. Live end-to-end test uitvoeren
Ik dien via de publieke URL `https://coffeeshopbond.nl/aanmelden` (of het formulier dat daar staat) een testaanvraag in met een duidelijk zichtbaar testadres (bijv. `Testshop AAN-CHECK` / `test+aanmelden@leden.coffeeshopbond.nl`) en controleer daarna:
- rij in `membership_requests` met `status = 'approved'`;
- nieuw record in `members_data` met `member_type = 'member'`;
- record in `member_allowed_emails` en `member_mailing_preferences`;
- bevestigingsmail aan aanmelder + notificatie aan secretariaat verstuurd (via `email_send_log`).

Zo weten we zeker dat de volledige keten werkt.

### 2. Dubbele mail-trigger opruimen
Migratie: verwijder de duplicaat trigger `trg_notify_on_membership_request`, houd `after_insert_membership_request_notify`. Ook de dubbele INSERT-policy "Anyone can submit membership request" opruimen.

### 3. Testrecord opruimen
Na de test verwijder ik de testrij netjes uit `membership_requests`, `members_data`, `member_allowed_emails` en `member_mailing_preferences`.

### 4. Rapportage
Ik lever daarna een korte samenvatting: aanmelding → lid → mailing → mail-notificatie, elk met een OK/fout.

## Wat ik NIET aanraak
- De aanmeldflow-code en het publieke formulier zelf (die werken).
- De autoconvert-logica in `auto_create_member_from_request` (draait naar behoren).
- Overige mailtemplates.

## Vraag ter bevestiging
Wil je dat ik een echt formulier op de publieke site invul via Playwright, of geef je de voorkeur aan een directe database-insert die dezelfde trigger-flow aanroept? Beide bewijzen de keten, maar het formulier test ook de RLS/anon-permissies van buitenaf.
