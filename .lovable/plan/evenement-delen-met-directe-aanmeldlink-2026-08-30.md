# Evenement delen met directe aanmeldlink

Elk agenda-item krijgt een eigen deelbare link binnen het ledenportaal. Wie de link opent en nog niet is ingelogd, komt na inloggen (en MFA) direct bij dat evenement uit, met de aanmeldknop in beeld.

## Wat je krijgt

**Deelknop op de evenementkaart**
- Knop "Delen" op elke agendakaart (agenda-pagina en dashboardkaart).
- Menu met: Link kopiëren, Delen via WhatsApp, Delen via e-mail.
- Op mobiel gebruikt de knop het systeemdeelmenu wanneer dat beschikbaar is; anders het menu hierboven.
- De gedeelde tekst bevat titel, datum, tijd, locatie en de link.

**Eigen link per evenement**
- Adres: `https://leden.coffeeshopbond.nl/agenda/<id>`.
- Ingelogde leden: de agenda opent met dit evenement bovenaan, uitgelicht en automatisch in beeld gescrold.
- Niet-ingelogd: eerst het inlogscherm; na inloggen en MFA volgt automatisch de doorstuur naar hetzelfde evenement.
- Onbekend of niet-gepubliceerd item: nette melding "Dit agenda-item is niet (meer) beschikbaar" met link naar de agenda.

## Technisch

- Route `"/agenda/:eventId"` toevoegen in `src/App.tsx` binnen de beveiligde routes, naar `AgendaPage`.
- `src/components/ProtectedRoute.tsx`: bij doorsturen naar `/login`, `/mfa-setup` en `/mfa-verify` het huidige pad bewaren (sessionStorage-sleutel, bijv. `post_login_path`) — de bestaande SSO-redirect (`ssoRedirect.ts`) blijft voorrang houden.
- `src/pages/LoginPage.tsx`: bij een ingelogde+geverifieerde gebruiker eerst het bewaarde interne pad gebruiken in plaats van `/`; sleutel daarna wissen.
- `src/pages/AgendaPage.tsx`: `useParams` lezen; het gekozen evenement bovenaan tonen (ook als het in het archief valt), met accentrand en `scrollIntoView`; melding tonen als het id niet bestaat.
- Nieuw `src/components/agenda/AgendaShareButton.tsx`: bouwt de URL via `window.location.origin`, gebruikt `navigator.share` indien beschikbaar, anders dropdown met `navigator.clipboard.writeText`, `https://wa.me/?text=…` en `mailto:?subject=…&body=…`; bevestiging via `toast`.
- Deelknop plaatsen in `AgendaEventCard.tsx` (naast de aanmeldknop) en in `AgendaDashboardCard.tsx`.
- Geen databasewijzigingen; bestaande RLS en huisstijl (rode accenten, Archivo Black) blijven ongewijzigd.
