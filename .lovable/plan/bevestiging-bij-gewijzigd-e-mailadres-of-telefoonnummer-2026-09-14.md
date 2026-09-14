# Bevestiging bij gewijzigd e-mailadres of telefoonnummer

Wanneer een lid in "Mijn account" zijn eigen e-mailadres of telefoonnummer aanpast, krijgt dat lid direct een bevestiging per mail, met daarbij een agendabestand dat de wijziging als item in zijn eigen agenda zet.

## Wat de gebruiker merkt

- Lid past e-mail en/of telefoon aan en slaat op.
- Er gaat een bevestigingsmail naar het **nieuwe** e-mailadres met:
  - wat er gewijzigd is (oud → nieuw, per veld),
  - datum en tijd van de wijziging,
  - de melding dat de wijziging door het secretariaat wordt goedgekeurd wanneer dat nog moet gebeuren,
  - een korte regel "Niet zelf gedaan? Neem contact op met het secretariaat".
- Bij de mail zit een agendabestand (.ics) dat een kort item van 15 minuten aanmaakt op het moment van de wijziging, met de titel "Gegevens gewijzigd — Ledenportaal BCD". Het lid kan dat met één klik in Outlook, Apple of Google Agenda zetten. Er wordt geen antwoord (accepteren/weigeren) gevraagd.
- Wijzigt alleen de naam van de contactpersoon, dan gaat er geen bevestiging.
- Mislukt het versturen, dan blijft het opslaan gewoon lukken; het lid krijgt geen foutmelding over de mail.

## Technische uitwerking

**Nieuw e-mailsjabloon** `supabase/functions/_shared/transactional-email-templates/contact-details-changed.tsx`
- Props: `memberName`, `changes` (lijst van `{ label, oud, nieuw }`), `changedAt`, `pending` (boolean), `loginUrl`.
- Onderwerp: "Je contactgegevens zijn gewijzigd".
- Opgemaakt in dezelfde stijl als `agenda-registration-confirmation.tsx`.
- Registreren in `registry.ts` als `contact-details-changed`.

**ICS-ondersteuning** — `send-transactional-email/index.ts` bouwt al een `.ics` uit `templateData.icsEvent`. Hergebruiken zonder de functie te wijzigen: meesturen met `method: 'PUBLISH'`, uniek `uid` (`contact-change-<memberId>-<timestamp>`), datum/starttijd van de wijziging en eindtijd 15 minuten later. `PUBLISH` zorgt dat het een los agenda-item is en geen uitnodiging met RSVP.

**Verzendmoment** — in `src/pages/MijnAccountPage.tsx`, `handleSaveProfile`:
- vergelijk `editData` met de bestaande waarden en bouw de lijst wijzigingen voor `email` en `telefoon` (naam telt niet mee);
- na een geslaagde opslag (zowel het directe admin-pad als het goedkeuringspad, met `pending: true` bij het goedkeuringspad) `supabase.functions.invoke("send-transactional-email", ...)` aanroepen;
- ontvanger: het nieuwe e-mailadres wanneer e-mail is gewijzigd, anders het bestaande e-mailadres van het lid;
- `idempotencyKey`: `contact-change-<memberId>-<timestamp-minuut>` zodat dubbel opslaan geen dubbele mail geeft;
- fouten alleen loggen, niet tonen.

**Deploy** — `send-transactional-email` opnieuw uitrollen zodat het nieuwe sjabloon in het register zit.
