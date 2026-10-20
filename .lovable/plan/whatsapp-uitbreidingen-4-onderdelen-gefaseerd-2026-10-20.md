# WhatsApp-uitbreidingen (4 onderdelen, gefaseerd)

Uitgangspunt: alles blijft standaard uit en beheerder-only. Niets wordt verstuurd zonder expliciete beheerdersactie of toestemming (opt-in) van het lid. Elke fase wordt apart opgeleverd en getest. Publiceren pas na jouw akkoord, en een publicatie neemt altijd alle openstaande wijzigingen mee.

## Fase 1 - Foto's en PDF's bij doorgestuurde aankondigingen
- Een doorgestuurde foto of PDF van een toegestane afzender wordt veilig opgeslagen in een besloten opslag. Het onderschrift telt als tekst.
- Leden zien de bijlage bij de aankondiging op /aankondigingen, via een tijdelijke beveiligde link en nooit een openbare link.
- Lukt het downloaden niet, of is het bestandstype onbekend of te groot (max 20 MB, alleen jpg/png/pdf)? Dan wordt er niets gepubliceerd: het bericht blijft in de inbox met uitleg. Zo verschijnt er nooit een halve aankondiging.

## Fase 2 - Ledenservice-inbox (tweerichting)
- Berichten van leden aan het BCD-nummer verschijnen per gesprek in /whatsapp-inbox, gekoppeld aan het lid via een exact telefoonnummer (geen gokwerk).
- Beheerders kunnen binnen 24 uur gratis antwoorden met vrije tekst. Na 24 uur kan alleen een goedgekeurd sjabloon.
- Elke verzending wordt vastgelegd met de afzender (beheerder) en de bezorgstatus (verzonden/afgeleverd/gelezen/mislukt). Er zijn geen automatische antwoorden.

## Fase 3 - Meldingen via WhatsApp (opt-in)
- Leden zetten in hun profiel zelf "WhatsApp-meldingen" aan. Dat staat standaard uit en kan altijd uit; "STOP" werkt ook.
- Een beheerder kiest per aankondiging "Ook via WhatsApp versturen". Je ziet vooraf het aantal ontvangers en de geschatte kosten. Er zijn geen automatische verzendingen.
- Hiervoor is een Meta-goedgekeurd sjabloon nodig (marketing, betaald per bericht, goedkeuring tot 48 uur).

## Fase 4 - Agenda-herinneringen
- Per evenement kan een beheerder herinneringen aanzetten voor ingeschreven deelnemers met WhatsApp-opt-in, standaard 1 dag vooraf. Daarbij horen knoppen "Ik kom" en "Afmelden", die de inschrijving bijwerken.
- Elke deelnemer krijgt per evenement maximaal één herinnering, ook als een taak opnieuw draait.
- Dit vraagt een eigen goedgekeurd sjabloon (categorie utility).

## Wat jij moet regelen
- Sjabloonteksten voor fase 3 en 4 goedkeuren. Ik lever een concept aan en we dienen het samen in.
- Akkoord op kosten: marketingberichten zijn betaald, antwoorden binnen 24 uur gratis.
- Na elke fase: publicatiebeslissing (inclusief openstaande andere wijzigingen).

## Technische details
- Media: twee-staps download via de gateway (metadata, daarna gestreamde bytes met harde limiet), private bucket `whatsapp-media` met `<message_id>/<sha256>.<ext>`, admin-RLS. Leden krijgen signed URLs alleen via een RPC voor gepubliceerde aankondigingen. Herstel via de bestaande begrensde recovery.
- Verzenden alleen in admin-gecontroleerde server functions. Outbound-tabel met `wa_message_id`, status `accepted`, statusreconciliatie uit de bestaande webhook-inbox (geen downgrade van delivered/read). Reply-claims per inbound-id, en onzekere uitkomsten blijven "onopgelost".
- Opt-in in een nieuwe tabel met toestemmingstijdstip en bron. STOP-trefwoord zet de opt-in server-side uit.
- Herinneringen via pg_cron naar een route met server-only secret. Een unieke sleutel (event, deelnemer) voorkomt dubbele verzending. Knop-antwoorden komen via de webhook en werken de inschrijving bij via een bestaande RPC.
- Tests per fase: toegestaan/geweigerd, dedup/concurrency, statusvolgorde, opt-out, mislukte media blijft in de inbox, geen rolverbreding.
