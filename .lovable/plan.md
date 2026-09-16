# Logo's openbaar, foto's afgeschermd

Twee openstaande beveiligingspunten oplossen, met jouw keuze als uitgangspunt:
logo's van de coffeeshops mogen iedereen zien, al het andere alleen beheer.

## 1. Logo's van coffeeshops openbaar

Nu zijn de zelf geüploade ledenlogo's alleen zichtbaar voor ingelogde
gebruikers en worden ze via tijdelijke links geladen. Dat wordt:

- De map met ledenlogo's wordt openbaar leesbaar (iedereen kan een logo zien,
  niemand kan iets uploaden of wijzigen behalve beheer, bestuur en het lid zelf).
- De app laadt logo's voortaan via een vaste, openbare adres in plaats van
  tijdelijke links. Dat is sneller en de plaatjes blijven staan.
- De registerlogo's (automatisch opgehaald) blijven werken zoals nu, via het
  bestaande openbare logo-adres per coffeeshop.

Let op: openbaar betekent dat iemand met het exacte adres het logo kan
opvragen, ook zonder in te loggen. De lijst met leden blijft afgeschermd.

## 2. Foto's van contactpersonen afschermen

De foto's van contactpersonen zijn nu leesbaar voor elke ingelogde gebruiker.
Dat wordt beperkt tot:

- beheer en bestuur, en
- het lid zelf (alleen de foto's van de eigen contactpersonen).

Andere leden zien dan geen foto's meer van contactpersonen van andere bedrijven;
op die plekken verschijnen de initialen.

## 3. Database-functies afschermen

Een aantal interne functies is nu door elke ingelogde gebruiker aan te roepen,
waaronder het starten van synchronisaties, het versturen van een welkomstmail,
het archiveren/hernummeren van een lid en de interne mailwachtrij.

- Functies die alleen intern/automatisch draaien (mailwachtrij, trigger-functies,
  Outlook-melding) worden voor gewone gebruikers geblokkeerd.
- Functies die beheer vanuit de app gebruikt (synchronisaties starten, facturen
  klaarzetten, lid archiveren, welkomstmail) krijgen een controle in de functie
  zelf: alleen beheer/bestuur mag ze uitvoeren; anderen krijgen een nette
  foutmelding.
- Functies die bewust openbaar zijn (gedeelde evenementlink, status van een
  aanmeldverzoek) blijven ongewijzigd.

## Technische uitvoering

- Storage: bucket `member-logos` op public zetten; SELECT-policy voor
  `contact-photos` vervangen door admin/bestuur/eigen lid (zelfde conditie als
  de bestaande insert/update/delete-policy). `shop-logos` blijft privé achter
  `/api/public/shop-logo/$id`.
- `src/hooks/useMemberMedia.ts`: logo's via `getPublicUrl` in plaats van
  `createSignedUrls`; `useMemberLogosBulk` vereenvoudigen. Contactfoto's blijven
  signed en falen stil (lege map) voor gebruikers zonder rechten.
- Migratie met `REVOKE EXECUTE ... FROM anon, authenticated` op interne
  functies en een `if not (has_role(auth.uid(),'admin') or
  is_board_member(auth.uid())) then raise exception` in de beheer-functies
  (`trigger_*_sync`, `trigger_prepare_contribution_invoices`,
  `archive_member_with_renumber`, `next_member_number`,
  `send_welcome_email_admin`, `ensure_member_link`, `get_members_for_extern`
  houdt zijn eigen org-controle).
- Na uitvoering: security-scan opnieuw draaien en beide bevindingen afmelden.
