# Agenda: vergaderingen, evenementen en aanmeldingen

Een nieuwe agendapagina met bestuursvergaderingen en ledenevenementen, inclusief aanmeldingen die jij als beheerder kunt bijhouden, plus de eerstvolgende items op het dashboard.

## Wat je krijgt

**Agendapagina (`/agenda`, in de zijbalk)**
- Lijst met komende items, gegroepeerd per maand; daaronder een uitklapbaar archief met afgelopen items.
- Elk item toont datum, tijd, locatie, type (bestuursvergadering of ledenevenement) en het aantal aanmeldingen.
- Bestuursvergaderingen zijn zichtbaar voor alle leden, maar zonder aanmeldknop.
- Ledenevenementen tonen een knop **Aanmelden** / **Afmelden**.

**Aanmelden (leden)**
- Bij aanmelden geeft het lid het aantal personen op en optioneel een opmerking/dieetwens.
- Een lid kan zich weer afmelden zolang de datum nog niet voorbij is.
- Is het maximum aantal plaatsen bereikt, dan is aanmelden niet meer mogelijk en toont de kaart "Volgeboekt".

**Beheer (admin)**
- Evenement of vergadering aanmaken, bewerken en verwijderen: titel, omschrijving, datum, begin-/eindtijd, locatie, type, maximum aantal plaatsen, publiceren aan/uit.
- Deelnemerslijst per item: wie is aangemeld, met hoeveel personen en welke opmerking; totaal aantal personen bovenaan.
- Zelf een lid aanmelden of een aanmelding verwijderen vanuit die lijst.
- Knop **Vergaderingen genereren**: zet de eerste donderdag van elke maand voor een gekozen jaar in de agenda (slaat bestaande data over, dus dubbel klikken kan geen kwaad).

**Dashboard**
- Blok "Agenda" met de eerstvolgende 3 items: datum, titel, type en een link naar de agenda; voor ledenevenementen direct de aanmeldstatus.

## Technisch

Database (twee nieuwe tabellen, met RLS en grants):
- `agenda_events`: `title`, `description`, `event_type` ('bestuursvergadering' | 'evenement'), `event_date`, `start_time`, `end_time`, `location`, `max_seats`, `is_published`, `created_by`.
  - Lezen: iedere ingelogde gebruiker met een gekoppeld lid (gepubliceerde items) plus admins; schrijven alleen admins.
- `agenda_registrations`: `event_id`, `member_id`, `guests` (aantal personen, standaard 1), `note`, `registered_by`, uniek per (event, member).
  - Leden zien en beheren hun eigen aanmeldingen (via `member_profiles`); admins zien en beheren alles.
- Capaciteitscontrole via trigger op insert/update: telt bestaande personen en blokkeert bij overschrijding van `max_seats`.

Frontend:
- `src/hooks/useAgenda.ts` — react-query hooks voor events, aanmeldingen en mutaties (patroon van `useBenefits.ts`).
- `src/pages/AgendaPage.tsx` + route in `src/App.tsx` binnen de beveiligde routes, menu-item in `src/components/AppSidebar.tsx`.
- `src/components/agenda/AgendaEventCard.tsx`, `AgendaEventDialog.tsx` (beheer), `AgendaRegistrationDialog.tsx` (aanmelden), `AgendaDeelnemersDialog.tsx` (deelnemerslijst).
- `src/components/agenda/AgendaDashboardCard.tsx`, toegevoegd in `src/pages/Index.tsx`.
- Bestaande huisstijl: rode accenten, Archivo Black-koppen, mobile-first kaarten.
