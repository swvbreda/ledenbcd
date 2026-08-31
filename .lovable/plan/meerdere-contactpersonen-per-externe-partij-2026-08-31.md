# Meerdere contactpersonen per externe partij

Bij het uitnodigen van een leverancier of bedrijf kun je straks direct meerdere contactpersonen invoeren. Iedere persoon krijgt een eigen account voor dezelfde organisatie en een uitnodigingsmail met inloggegevens. Daarnaast kun je contactpersonen later beheren op de detailpagina van de partij.

## Uitnodigingsformulier

- Onder "Contactpersoon" komt een lijst met regels: naam + e-mailadres per persoon.
- Knop "Contactpersoon toevoegen" voegt een extra regel toe; per regel een verwijderknop (minimaal één regel blijft staan).
- Bij versturen: organisatie wordt aangemaakt (of hergebruikt), en voor elke regel wordt een account met tijdelijk wachtwoord aangemaakt, gekoppeld aan die organisatie, plus een uitnodigingsmail.
- De eerste persoon blijft de hoofdcontactpersoon van de organisatie (`contact_name` / `contact_email`); alle personen worden ook opgeslagen als contactpersoon van de organisatie.
- Resultaatmelding vermeldt hoeveel uitnodigingen zijn verstuurd; bestaande e-mailadressen worden overgeslagen met een duidelijke melding in plaats van een harde fout.

## Detailpagina externe partij

- Blok "Contactpersonen" met de bestaande lijst (naam, functie, telefoon, e-mail).
- Toevoegen, bewerken en verwijderen van contactpersonen.
- Per contactpersoon met e-mailadres een knop "Uitnodigen" die alsnog een account aanmaakt en de inlogmail stuurt (of "Heeft al toegang" als er al een account aan de organisatie hangt met dat adres).

## Technische details

- `supabase/functions/invite-extern/index.ts`: payload uitbreiden met `contacts: [{ name, email }]` (oude `contact_name`/`email` blijft werken). Per contact: account aanmaken, rol `extern`, koppeling in `external_org_users`, rij in `external_org_contacts`, mail via bestaande `extern-invite` template. Per contact een resultaatstatus terug (`sent` / `already_exists` / `error`) zodat één fout de rest niet blokkeert.
- `src/pages/ExternePartijenPage.tsx`: uitnodigingsdialoog aanpassen naar dynamische contactregels.
- `src/pages/ExternePartijDetailPage.tsx`: CRUD op `external_org_contacts` (admin-policy bestaat al) plus uitnodigen-knop per contact.
- Geen schemawijziging nodig; `external_org_contacts` en `external_org_users` ondersteunen meerdere personen al.
