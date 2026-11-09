# Bestuur → Vergaderingen en notulen (niet gepubliceerd)

## Resultaat
- `/bestuur/notulen`, detail `/bestuur/notulen/<id>`, gedeeld desktop/mobielmenu onder Bestuur.
- Bestuur/admin lezen; admin-only beheer/vaststelling. Bestaande `has_role`, `is_board_member`, accountrevocation en bearer middleware onveranderd. Alle metadata/tekst/zoekresultaten en originele bestanden onder RLS; geen anon grants, publieke bucket of signed links.
- Zoek alle versie-inhoud/onderwerpen/besluiten/acties; jaarfilter op vergaderdatum nieuwste versie; één resultaat per vergadering. Detail selecteert historische versies.
- Append-only verslagversies, bron-id en bestand/inhoudhash-dedup; originele namen en bestanden blijven bewaard. Nieuwe concepten erven bestaande bijlagen. Expliciete admin-vaststelling van nieuwste versie met origineel aanwezig; vastgestelde/historische versies accepteren geen nieuwe bijlagen. Stale edits afgewezen. Adminactor/tijden servergeschreven.
- Upload PDF/DOCX/DOC/TXT tot 20 MB; server valideert bestandsnaam, grootte en bytes. DOCX/PDF/TXT-tekst lokaal expliciet overnemen; scans zonder tekst en oude DOC vragen handmatige tekst. Besluiten/acties afzonderlijk invullen, geen verzonnen extractie.
- Download haalt private bytes geauthenticeerd op; vervolgens expliciete opslagklik bewaart browseractivatie, iOS gebruikt waar beschikbaar bestandsdelen. Geen externe verzendacties.

## Bronnen
- Bestaande Topical-module bevat Microsoft To Do/Planner-taken, geen verslag-API. Alle 12 agenda-items met event_type bestuursvergadering hadden meeting_url NULL. Geen toegankelijk bestuursverslag aangetroffen/geïmporteerd; taken, ALV en andere overleggen niet omgezet.
- Beschikbare OneDrive-verbinding gezien maar niet gekoppeld/gebruikt: gebruiker levert oude documenten later; geen credentials aangevraagd. Upload kiest expliciet OneDrive/Topical, bron-id en https-bronverwijzing.
- Archief blijft leeg: geen echte notulen of productie-testrecords toegevoegd.

## Validatie
- 17 gerichte regeltests + 3 echte componenttests geslaagd. Componenttestomgeving kreeg alleen een tijdelijke optionele-canvas resolutieguard; projectconfiguratie niet gewijzigd.
- Afzonderlijke PostgreSQL 17 met live `auth.uid`/`has_role`/`is_board_member`/revocationdefinities: admin save/read/adopt, board read/storage-select en mutations denied, member/extern/inhuur/anon alle tekst/metadata/opslag geweigerd; dedup, hashes, inherited originals, stale edits, append-only grants, vaststelling en nieuwe conceptversie gecontroleerd. Transaction rollback: 0 vergaderingen/0 objects.
- Echte anonieme app opent login. Synthetische echte overzichtcomponent in aparte browserroot met bestaande routeromgeving: desktop/390px, zoeken op besluiten, wissen, geen page-overflow of consolefout. Echte downloadcomponent met uitsluitend lokale Blob-fixture bewaart exacte bytes en oorspronkelijke naam. Dit is geen ingelogde productie-E2E.
- Automatische bouw/typecontrole: build OK.

## Beperkingen en isolatie
- Volledige ingelogde upload/save/readback/adopt/download ontbreekt: eigen-account sessiemint gaf geen match; geen account van derden gekozen, geen fictieve sessie/authbypass. Gebruiker moet in preview inloggen voor verdere controle.
- Upload en metadata-koppeling zijn twee stappen; mislukte koppeling behoudt originele bytes en toont fout, retries dedupliceren. Een concept zonder gekoppeld origineel kan niet worden vastgesteld.
- Nog geen automatische Topical/OneDrive-import, OCR of DOC-tekstextractie; bron-id/herkomst handmatig gecontroleerd bij upload. Geen bronverwijdering of -overschrijving.
- Uitgangs-HEAD bfb2d2230c671bb98075026c09d3329959abffee, initieel schone boom. Wijzigingen: board-minutes modules/routes/tests, menu, roadmap/AGENTS/review, drie nieuwe migraties + gegenereerde types/journal/router, mammoth/package/bun.lock. Geen auth/native/accounting/push/mail/Planner/Topical-logica gewijzigd, geen Git-schrijfacties of publicatie.