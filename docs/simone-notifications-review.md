# Simone meldingen — alleen-lezen onderzoek, 5 november 2026

## Publicatie: echte live readback

Op 19:20–19:22 UTC leverde `https://leden.coffeeshopbond.nl` HTTP 200 met hoofdscript `index-D1bUwHYy.js`.

- `memberDossierIdentity-BJLn5-AY.js`: werkelijk geleverde code controleert bestaande canonical ID vóór conversiehistorie; aanvraagmatch gebruikt vastgelegd ID en shop/plaats. `leden._id-BAJdQGKg.js` mount de pagina per ID. `goedkeuringen-ClW2L6AZ.js` bevat de nieuwe waarschuwing voor ontbrekende/ambigue koppeling.
- `_dashboard-DlG54GiX.js` bevat de nieuwe sectie **Lokale afdelingen**.
- `BeleidDocumentenLijst-Ca78J_Rk.js` bevat **Opnieuw proberen** en **Log opnieuw in**.

Dit bevestigt dat de drie goedgekeurde frontendreparaties werkelijk worden geleverd, niet alleen dat publicatie is aangevraagd. Geen deploymentstatus-API beschikbaar voor deployment `454d01b1-b962-4d33-98dc-1e4e56de9439`; geen nieuwe publicatie gestart. Volledige ingelogde GOA/woordvoerders/beleidsketen en live beschermde serverrespons niet opnieuw geverifieerd zonder sessie; bundelreadback is geen vervanging daarvan.

## Identiteit en ontvangers

Simone is uitsluitend geïdentificeerd via bestaand Auth-record met email `simone@coffeeshopbond.nl`, UUID `a7fce7fa-600b-48ef-8faf-7aea6918660a`; bestaande rol in `user_roles` is `admin`. Geen nieuwe rollen/koppelingen.

## Belletje (in-app)

`TaskNotificationsBell.tsx` leest uitsluitend **task_notifications** (eigen ontvanger via RLS), niet aanmeldingen, aankondigingen of declaraties. Polling elke 60 seconden. Voor Simone staat precies één melding geregistreerd:

- Aangemaakt **12 oktober 2026 16:28:07 UTC**, pushstatus `sent`, **2 geaccepteerd van 3 toestellen**, daarnaast `410 Unregistered` voor een ongeldig toestel.
- Gelezen **12 oktober 2026 16:29:07 UTC**; **0 ongelezen**, geen latere taakmeldingen voor Simone.

Een belletje zonder teller is met die echte gegevens verklaarbaar. Dit bewijst geen kapotte leesketen. Task-trigger is actief; deze genereert geen melding bij eigen toewijzing, afgeronde taken, ontbrekende/ongeldige verantwoordelijke, ongewijzigde verantwoordelijke of Microsoft-import. Geen regels veranderd zonder specifieke opdracht.

## Telefoon / registratie / voorkeuren

- **Twee iOS-registraties** voor Simone; laatste updates **24 oktober 17:06:56 UTC** en **5 november 16:40:33 UTC**. Geen tokens gelezen/geprint.
- Geen centrale meldingsvoorkeurentabel in deze keten: Mijn account gebruikt registraties plus lokale `bcd-push-disabled`. Lokale telefoonkeuze en actuele iOS-toestemming zijn hier niet uitleesbaar. Bestaande registraties bewijzen niet dat Apple beide nog accepteert of dat banners op haar telefoon zijn toegestaan.
- Native Capacitor/APNs, geen browser-webpush/serviceworker in deze keten. Bestaande entitlement: Debug development, Release production; server gebruikt Apple production en de bestaande app-bundle-ID.
- App wist ontvangen meldingen/badge bij openen, terugkeer naar foreground en ontvangst terwijl zichtbaar. Dit bestaande gedrag kan verdwijnen van meldingen verklaren, maar is geen bewezen oorzaak van niet-ontvangen zolang meldingtype onbekend is; niet gewijzigd.
- APNs-configuratie aanwezig in sandbox; lokale JWT-ondertekening **geslaagd**, zonder netwerk. Dit bewijst geen live provideracceptatie.

## Declaratieketen

- Live `declaration_push_settings.enabled=true`, `scheduler_armed=false` (laatst gewijzigd **22 oktober 17:31:31 UTC**).
- Geen cronjob met push/notif-naam aanwezig: automatische declaratiewekker is niet geïnstalleerd/actief.
- `zz_declaration_submit_notify` actief, bestaande vaste ontvangersfunctie bevat Simone en de vastgelegde Bernard-identiteit met huidige approvercontrole.
- **0 declaration_notifications**, zowel voor Simone als totaal; dus geen laatste declaratiepush/fout/achterstallige rij te bewijzen.
- Clientversnelling bestaat bij indienen; achtergrondopvang is niet actief. Niet aangezet tijdens onderzoek, geen backfill en geen testdeclaratie.

## Nieuwe aanmelding / providerlogs

- Laatste echte aanmelding: **5 november 17:04:59 UTC** (GOA). Laatste wijzigingsverzoek: **30 september 20:40:38 UTC**. Laatste aankondigingspublicatiedatum: **3 november 14:36:02 UTC**.
- Aanmeldingtrigger is actief en roept bestaande `notify-membership-request` aan met intern-geheimcontract.
- In `net._http_response` rond **17:05:00 UTC**: request **4118** retourneert **401 Unauthorized**; **4119** heeft **5-seconden transporttimeout**; **4117** heeft HTTP 207.
- Responses bewaren geen oorspronkelijke request-URL/body in deze inspectie. De temporele samenhang met GOA is sterk, maar de response kan niet ondubbelzinnig aan de aanmeldmelding worden toegewezen. Geen claim dat specifiek 4118 dé mislukte GOA-push is.
- Recente functionlogs voor `send-push`, `notify-membership-request`, `notify-edit-request` beschikbaarheidscheck: **geen logs gevonden**; dat bewijst niet dat ze niet zijn aangeroepen.
- Aanmeldsender negeert status/resultaat van zijn send-push-aanroep. Daardoor bestaat geen duurzame, per-Simone bewijsregistratie voor deze broadcasts; afleversucces is niet uit records te reconstrueren.
- Geen geheimwaarden vergeleken/geprint, geen verzwakte auth, geen nieuwe verzender gemaakt, geen replay van GOA-trigger (die ook mails zou sturen).

## Tests en status

**21 bestaande geïsoleerde meldingsregressies geslaagd** (8 taak, 13 declaratie), geen echte send. Automatische build OK. Geen nieuwe functionele codefix toegepast omdat er nog geen eenduidige oorzaak is die veilig kan worden gewijzigd zonder het gemelde type te weten; 401/timeout moeten eerst aan endpoint worden gekoppeld.

Open: is Simone's melding **het belletje, iPhone-banners of beide**, en om **aanmelding, aankondiging, taak of declaratie**? Telefoontoestemming/locale voorkeur en echte live API/provideracceptatie blijven onbewezen. Een echte test naar Simone mag alleen na specifieke toestemming; geen tests naar anderen.

Geen publicatie, mails, pushberichten, declaratie-/taakstatuswijzigingen, scheduleractivatie of gegevensmutaties uitgevoerd.