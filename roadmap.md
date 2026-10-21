# Roadmap

## Outlook-taakdeadlines (geen publicatie)
- [x] Deadline-engine, beveiligde outbox en beheerstatus gebouwd; 89 engine/regressietests, 2 componenttests, echte geïsoleerde SQL/gelijktijdige claim en DB→mock Graph→finish-ketentest geslaagd; 390px/desktop gecontroleerd. Review: docs/outlook-deadlines-review.md. Standaard uit, geen backfill of Microsoft-schrijfacties.
- [ ] Live Calendar-leestoegang en releasevoorwaarden: Calendars.ReadWrite en Tasks.ReadWrite.All tokenrechten bevestigd; mailboxread geblokkeerd door 0 bevestigde mappings. Activatie/releasegate blijft uit tot juiste mapping, pilot en volledige release review; unknown/conflict handmatig herstel en geplande dispatcher nog niet ingebouwd.

## Open
- [x] WhatsApp → Aankondigingen geïmplementeerd: 33 unit- en 3 rendertests, geïsoleerde SQL-rollbackproeven en 12 gelijktijdige ingests → 1 aankondiging; admin-preview standaard deny zichtbaar. Review/release-afbakening: docs/whatsapp-release-review.md. Geen echte aankondiging/notificatie of publicatie.
- [ ] WhatsApp activeren/verifiëren: echt publishernummer ontbreekt; allowlist blijft leeg. Selectieve release vereist exact laatst gepubliceerde commit + afzonderlijke releaseworkflow zonder persoonlijke toegang/deel-previews/Agenda-mailactie; daarna één echte forwarded ontvangst tot ledenweergave controleren.
- [x] Minimale WhatsApp connector-ontvanger: officiële handtekeningcontrole, duurzame admin-inbox, bestaande idempotente ontvangst, herstel op vervolgcallbacks; 29 tests en rollback-only opslagregressie geslaagd. Nog niet gepubliceerd; echte callback pas na deploy verifiëren. Geen verzending/import.
- [x] Leads afgeschermd via leesrechten en gedeelde gegevensfilters; 32 regressietests geslaagd. Preview met echte Bulldog-ledensessie: 119 leden, geen leads op overzicht/ledenlijst of via leadtab-link; admin Simone en Bernard: 119 leden en 9 leads apart. Bernard heeft adminrechten: zuivere bestuursrol blijft ongecontroleerd totdat een bestuursaccount zonder adminrechten is aangewezen; geen rollen/inhoud gewijzigd of publicatie.
- [ ] Vereenvoudigde ledentoegang met persoonlijke bevestigings-/inloglinks; veilig koppelen en geïsoleerd testen; niet publiceren.
- [x] Deel-previews: goedgekeurd en verwerkt in preview; nog niet publiceren.
- [ ] Financiële module: Informer als enige bron (canonieke tabellen, jaarsync, overrides, betaalkoppelingen, controlemodule)
- [x] Veldmapping verkoop-/inkoopfacturen 2026 gevalideerd (totals, status, ledger_id->rubriek, relation_id->naam) + tests
- [x] Readiness/reconciliatiestatus (ledgerReadiness) zichtbaar in Controle & sync
- [x] Ponto alleen saldo/betaaldatum/koppeling; begroting, resultaat en dossiers lezen de canonieke boekhoudregels
- [x] Tests: 13 tests (idempotentie, geen dubbeltelling, statusfilters, splits, readiness, overrides)
- [x] 2026-sync gedraaid; verschillen met het boekhouddashboard zichtbaar als "niet volledig gereconcilieerd"
- [ ] Contributiestatus uit de boekhouding: API levert maar 9 verkoopfacturen 2026, rest ontbreekt (uitzonderingenlijst)

## Klaar
- [x] Coffeeshopregister-sync gebruikt het beveiligde export-endpoint met de juiste sleutelheader en antwoordvelden; publieke tabeltoegang is niet meer nodig
- [x] Push-/koppelsleutels opnieuw ingevoerd (REGISTER_PUSH_SECRET, COFFEESHOPBELEID_API_SECRET, BCD_KOPPEL_SLEUTEL)
- [x] Certificaatfout `coffeeshopbeleid.nl` opgelost: basisadres instelbaar (standaard `.com`) + terugval bij netwerkfouten
- [x] Beleidsmonitor-sync (leden push/dossiers) werkt: 173 verstuurd, 174 dossiers

## Ledentoegang met persoonlijke link (geblokkeerd voor livegang)
- [x] Voorbereide inlog-, bevestigings- en aanvraagcode achter standaard uitgeschakelde schakelaars; bestaande toegang blijft actief.
- [ ] Auth-mailtemplate/redirects veilig configureren, RLS-migratie toetsen en toepassen, geïsoleerde positieve Auth + mailopvang + sessie + eigen-dossier-ketentest uitvoeren. Blokkade: geen afgeschermde Auth-/mailomgeving of goedkeuring om productieconfiguratie te wijzigen.
- [ ] Welkomstmail met één persoonlijke knop veilig aansluiten zonder tweede mail; blokkade: Auth-mailafhandeling moet eerst positief bevestigd zijn.
- [x] Afzonderlijk: "Mail alle deelnemers" in Agenda > Deelnemers (beheer, preview; niet gepubliceerd, geen mail verstuurd).

## WhatsApp-uitbreidingen
- [x] Fase 1: foto's/PDF's bij doorgestuurde aankondigingen
- [x] Fase 2: Mijn vragen + centrale inbox + geverifieerde WhatsApp-koppeling en antwoorden (preview, niet gepubliceerd)
- [ ] Mijn vragen: rolgebaseerde SQL-proef (supabase/tests/support_questions.sql) in geïsoleerde fixture-DB en ingelogde 390px/desktop-controle; blokkade: geen fixture-DB/testaccount in deze omgeving
- [ ] Fase 3: WhatsApp-meldingen opt-in (wacht op sjabloontekst + kostenakkoord)
- [ ] Fase 4: agenda-herinneringen (wacht op sjabloontekst)
