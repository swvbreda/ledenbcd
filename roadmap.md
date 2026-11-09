# Roadmap

## Gedeelde bestuurstaak — niet publiceren
- [x] Migratie 0085: één gedeelde privétaak, echte registerleden en actieve accountmatching, geen aspiranten/admin-zonder-bestuursfunctie. Zeven bestuursnamen, zes actieve beheeraccountmatches; één ontbrekend account blijft zichtbaar, geen account/rechten aangemaakt.
- [x] 41 regeltests, 9 bedieningstests (defecte optionele canvas tijdelijk gestubd) en geïsoleerde SQL-proef met afronden/heropenen/idempotentie/privacy geslaagd; bouw OK. Geen berichten, live 0 privétaken.
- [ ] Simone activeert via nieuwste concept → '15 conceptacties aan taken koppelen' → 'Bevestig taakregistratie'; ingelogde eindcontrole ontbreekt, agent signed_out, geen mint/alternatieve identiteit of publicatie.

## Bestuursnotulen → bestaande taken — niet publiceren
- [x] Bestaande admin-taakrechten behouden; aparte privé actie-/versiebinding en meerdere expliciete betrokkenen zonder rechtenuitbreiding; geen melding/Microsoft/projectbinding of MCP-feed.
- [x] Adminactivatie nieuwste concept 6 november, automatische nieuwe uploadnotulen/vervolgversies, actuele status en admin-toewijzing gebouwd; migratie 0084 toegepast. Live: 182 vergaderingen, 0 privétaken/koppelingen/geactiveerde vergaderingen; geen herimport of taakmutatie.
- [x] Geïsoleerde SQL-proef met echte validatie/afrond/melding/Outlook-triggers en 40 regeltests + 8 componenttests; automatische bouw OK.
- [ ] Simone activeert de 15 acties via nieuwste concept → '15 conceptacties aan taken koppelen' → 'Bevestig taakregistratie'; eigen sessie ontbreekt, geen mint/alternatieve identiteit. Ingelogde eindcontrole/publicatie door gebruiker.

## Bestuur → Vergaderingen en notulen — niet publiceren
- [x] Rechten-timeout onderzocht: Cloud gezond/geen hangende DB-query; bootstrap las dezelfde sessie herhaald via preview-broker (getUser zonder token + iedere REST/RPC). Nu Auth-aangeleverd token expliciet server-geverifieerd en RLS caller-client zonder sessieopslag; 20s ongewijzigd, geen rechten/MFA/bypass/herimport. Read-only: 182 vergaderingen, 320 privéobjecten, 13 complete nieuwste opmaakversies, 0 vaststellingen. 12 AuthProvider-tests incl. blokkerende opslag en geweigerde token; eigen sessie blijft onbeschikbaar voor agent, laatste UIcontrole door gebruiker. Bestaande bouwblokkade in drie Contacten-testselectors alleen ongeldig exact verwijderd (string matching blijft exact).
- [x] Schema-2 topical-formatted ZIP in bestaande Archiefpakket-bediening: exact 13 bestaande bronIDs/26 gehashte DOCX/PDF, gedeelde append-only versie per paar, originele PDF-hash en alle bestaande vergaderingen vóór writes gecontroleerd, latest-lock/full-content-idempotentie, geen vaststelling/taakactivatie. Metadata te controleren, AI/brief/agenda onderscheiden. 35 regeltests + 4 componenttests en geïsoleerde SQL-versie/rechtenproef geslaagd; migratie 0083 toegepast/read-only teruggelezen, bouw OK. Geen werkelijke import door assistent; eigen browserketen wacht op aangeleverd schema-2-pakket en gebruikersupload.
- [x] Broncorrectie Topical in import/print: 2 april AI-verslag met bronwaarschuwing, 7 mei beknopte notities met één historische actie alleen in brontekst, alleen 4 juni verslag ontbreekt; tien samenvattingen behouden. Alle 13 echte manifestbronnen gecontroleerd, 27 regeltests + 4 componenttests geslaagd, automatische bouw OK. Geen inhoud herschreven of private records gewijzigd; eigen sessie nog signed_out.
- [ ] Gestandaardiseerde Topical DOCX/PDF aanvullingen privé toevoegen aan dezelfde vergaderingen; wacht op aanlevering en bruikbare eigen adminsessie, geen nieuwe lege/duplicaatrecords.
- [x] Previewachterstand gecontroleerd: hosted preview bouw 06e85bc geslaagd en synchroon; lokaal /bestuur/notulen gaat zonder sessie naar login. Externe link geeft zonder platformlogin HTTP 401, niet 404. Blokkerende Contacten-fixtures kregen uitsluitend lege nieuwe schema-velden; geen app/datawijziging. Importbediening componenttest, geen echte import; hosted eigen sessie ontbreekt.
- [x] Historisch pakket volledig gevalideerd: 168 OneDrive + 13 Topical / 292 originele SHA256-bestanden, 5 uitsluitingen; private ZIP-import met bron-id/versies/dedup en terugleescontrole, historische/onvolledige status en A4/Palatino-weergave gebouwd. Broncorrectie: ontbrekende kop Samenvatting is geen bewijs voor ontbrekend verslag. Migratie 0082 bevat alleen schema/RPC, geen broninhoud. Desktop/390px synthetisch gecontroleerd; eerdere tests en beide geïsoleerde rechtenproeven.
- [ ] Werkelijke import van 181 historisch + nieuw concept en 294 originele DOCX/DOC/PDF-bestanden, routes/IDs en alle privé downloads verifiëren: geen eigen bevoegde sessie beschikbaar; archief blijft leeg. Geen auth-bypass, publicatie of taakactivatie.
- [ ] Aangeleverd conceptpakket 6 november privé importeren met bron-id `handmatig:2026-11-06:bestuur`, DOCX/PDF origineel bewaren en TXT doorzoekbaar; uitsluitend concept, dinerbijdrage onbevestigd en deelnemers onbekend. Geen gevoelige inhoud in repository/SQL-migraties/assets. Wacht op bruikbare eigen adminsessie voor bestaande gecontroleerde import.
- [x] /bestuur/notulen en /bestuur/notulen/$id, afzonderlijk besloten archief met bestaande bestuurs/adminrechten, append-only versies en private board-minutes bucket; alleen admin beheren/vaststellen. Migraties 0079–0081 toegepast.
- [x] Overzicht/inhoudzoeken/jaarfilter, detail/besluiten/acties, originele upload/download, bron-id/hash-dedup en tekstovername PDF/DOCX/TXT. Topical: takenkoppeling, 12 bestuursagenda-items zonder meeting_url, geen beschikbare verslagimport; geen externe writes.
- [x] 17 regeltests + 3 echte componenttests, afzonderlijke PostgreSQL-rechten/versies/opslagproef (rollback 0/0), desktop/390px overzicht en synthetische download, bouw OK. Scope uitsluitend notulen/menu/documentatie/gegenereerde schema/routerbestanden en mammoth-afhankelijkheid.
- [ ] Volledige ingelogde upload→herladen→vaststellen→downloadcontrole: eigen preview-sessie ontbreekt; eigen-account mint gaf geen match, geen ander account gekozen. Topical-import wacht op toegestane verslagbron; OneDrive-documenten en nieuw concept wachten op aanlevering. Niet publiceren.

## Contacten categorieën + Functie-filter — niet publiceren
- [x] 12 categorieën (migratie 0078 toegepast, alleen CHECK), labels, Functie-filter met URL-state, filters wissen; 20 tests.
- [ ] Herindeling 51 organisaties (17 gecontroleerde categorie-updates): assistent voert uit na review, daarna publicatie. Geen actie voor Simone.

## Intern adresboek Contacten — niet publiceren
- [x] Eigen adresboekopslag; migraties 0076/0077 toegepast, bestaande has_role/is_board_member geverifieerd, RLS en minimale grants teruggelezen.
- [x] /contacten en /contacten/$id, organisatie-/persoonszoekresultaten, formulieren, gedeeld desktop/mobielmenu en rij-gecontroleerde opslag/verwijdering.
- [x] Geïsoleerde PostgreSQL met actuele helperdefinities: twee contacten, CRUD/readback/cascade, admin/bestuur toegestaan en lid/extern/ongelinkte inhuur/anon geweigerd; rollback 0/0. Componenttests en formulier desktop/mobiel; bouw OK. docs/address-book-review.md.
- [ ] Volledige ingelogde browserketen (toevoegen/herladen/zoeken/menu): preview signed_out; geen sessie beschikbaar, geen authmint uitgevoerd. Gebruikerreview nodig; niet gepubliceerd.

## Lokale woordvoerders — gerichte dashboardreview 6 november (niet publiceren)
- [x] Productie bevat eerdere fix én resterende Aspirant-tak/incomplete fallback; actuele website levert vier woordvoerders. Echte dashboardcomponent gebruikt alleen bronroster onder Lokale woordvoerders; geen oude fallback, expliciete fout/herpoging, Joachim blijft bestuurder. Acht tests en desktop/mobiele presentatiecontrole geslaagd, build OK; docs/dashboard-spokespeople-review.md. Geen publicatie/rechten/data/verzending.
- [ ] Echte ingelogde dashboard/toestelcontrole: sessie signed_out, geen authmint; screenshot met Aspirant niet volledig verklaard door huidige live predicate, oudere geladen client mogelijk maar onbewezen. Review door Simone nodig.

## Telefoon: ingelogd blijven + sneller openen (geen publicatie)
- [x] Oorzaak: tijdelijke vernieuwingsfout bij koude start/terugkeer gaf INITIAL_SESSION null → loginscherm terwijl sessie bewaard bleef (server: Simones app-sessie sinds 22 okt actief, 0 ingetrokken sessies). Herstel: 'verbinding herstellen' i.p.v. login, automatisch opnieuw, geen geforceerde rotatie bij terugkeer, verlopen-melding logt alleen uit bij definitieve weigering; ledenkoppeling één rondgang korter. 10 nieuwe + 21 bestaande tests. Review: docs/session-persistence-review.md.
- [ ] Echte iPhone-controle na publicatie: geen fysieke telefoon/eigen sessie beschikbaar.

## Gericht sneller openen (geen publicatie)
- [x] Signed-out cold/warm live+preview en bezoekers-p75 gemeten; dashboardlayout/grafieken lazy, eigen RLS-rijen+geschoonde directory parallel/atomair. 18 regressies, desktop/mobiel en build OK. Minder code bewezen, geen betrouwbare totale tijdwinst; docs/startup-performance-review.md. Niet gepubliceerd.
- [ ] Ingelogde opstart en fysieke iPhone meten: eigen sessie niet beschikbaar; geen nep-login of andere account gebruiken.

## Publicatiecontrole + Simone meldingen (geen nieuwe publicatie/verzending)
- [x] Echte live frontendbundels bevatten GOA/canonical-ID+keyfix, woordvoerders en beleidsherpoging/sessieboodschap. Simone uit bestaande account/rolrecord geverifieerd; 2 iOS-registraties, 0 ongelezen taakmeldingen, laatste taakpush 12 oktober 2/3 geaccepteerd + 410; 0 declaratiemeldingen, enabled=true maar scheduler_armed=false en geen pushcron. Aanmeldtijd 17:05 bevat 401/timeout zonder bewezen endpointcorrelatie; providerlogs ontbreken. 21 geïsoleerde tests + lokale signing OK, geen berichten of functionele wijzigingen/publicatie. Review: docs/simone-notifications-review.md.
- [x] Telefoonpushfocus: concrete foregroundfout hersteld in preview — ontvangen push werd direct via removeAllDeliveredNotifications gewist vóór iOS-banner/listpresentatie. Receipt wist/logt payload niet meer; open/resume/tap en voorkeuren behouden. 3 geïsoleerde hooktests en build OK; niet gepubliceerd, geen send. Aanvullende HTTP-/APNs-logs leeg, dus geen actuele telefoonaflevering bewezen.
- [ ] Actuele iPhone-toestemming/voorkeur en bezorging bij gesloten app vaststellen; 401 aan exact endpoint correleren. Echte Simone-test vereist specifieke toestemming, ingelogde keten vereist beschikbare eigen sessie. Ontvangstfix eerst review/publicatiegoedkeuring.

## GOA / Scolo dossierkoppeling (geen publicatie)
- [x] Live readback: GOA Leiden 150, Scolo IJmuiden 32; Pascal account/allowed-email uitsluitend 150, rol user. Aanmelding cadbda42-08c2-4524-864a-13d32df0e0fc matched 150. Oude conversie 150→32 veroorzaakte onvoorwaardelijke redirect. Canonieke rij gaat nu voor; geen reconstructie uit historie, aanvraag-ID+shop/plaatscontrole, pagina per ID opnieuw gemount. 11 dossierregressies + 22 eerdere contact/beleid/woordvoerderstests geslaagd, build OK. Geen data-/rechten-/financiële mutatie, verzending of publicatie. Review: docs/goa-scolo-dossier-review.md.
- [ ] Echte admin- en Pascal-login doorklikcontrole: eigen beheersessie niet beschikbaar; geen sessie nagebootst en geen account van derden gebruikt. Gebruikercontrole in preview nodig.

## Beleid laden (geen publicatie)
- [x] Bron geeft HTTP 200, 342 gemeenten en echte documenten voor zeven gemeenten; geen actuele 404. Bron/bodyfouten, timeout/404-diagnose, eindeloos laden zonder sessie en handmatige herpoging gericht aangepakt; tests/bouw gecontroleerd. Geen publicatie of bronkopie. Review: docs/policy-loading-review.md.
- [ ] Ingelogde beleidsweergave controleren: eigen beheersessie ontbreekt; preview opent login, gebruikercontrole vereist.

## Dashboardwoordvoerders (geen publicatie)
- [x] Actuele website/bron vergeleken; vier afdelingen uit gepubliceerde bron teruggelezen, zes tests en desktop/mobiele componentfixture gecontroleerd; geen rollen/bronmutaties of publicatie. Review: docs/dashboard-spokespeople-review.md.
- [ ] Volledig ingelogde dashboardketen: geen beschikbare eigen beheersessie (`auth-session --self` vindt geen account); gebruikerreview in preview nodig. Componentfixture is geen volledige sessiecontrole.

## Lidmaatschapsbevestiging contributie-2026-11
- [x] Bestaande private requests en bevestiging behouden; individuele adminbediening, vaste mailtekst, serverontvangers en atomaire claim/acceptatie toegevoegd.
- [x] 16 policy + 7 component + 2 edge-tests, geïsoleerde DB/concurrentieasserties, readback en bouwcontrole akkoord; bestaande mailfunctie gedeployed, alle 11 onverzonden, frontend alleen preview. Review: docs/member-reconfirmation-review.md.
- [ ] Echte ingelogde admin-previewcontrole: beschikbare sessie ontbreekt; gebruiker inspecteert en verstuurt zelf individueel, geen verzending tijdens voorbereiding.

## Belangrijke documenten (geen publicatie)
- [x] Canonieke catalogus verplaatst naar eigen beveiligde pagina onder Kennisbank; 15 documenten, 3 feitelijke onderwerpen/filter, oude sectielinks behouden; geen bronmutaties.
- [x] 13 tests en echte admin/anon desktop/mobiele preview gecontroleerd; automatische bouwcontrole akkoord. Extern bronbeheer onveranderd; geen onderwerp-editorcontract beschikbaar. Review: docs/important-documents-review.md. Niet gepubliceerd.

## Contactpersoon verwijderen (geen frontendpublicatie)
- [x] Review: migratie 0070 vergelijkt één-op-één met multipliciteit en blokkeert gedeelde login; uitnodigingen na geslaagde verwijdering hersteld. 6 echte form/hook/profieltests + 21 regressies en geïsoleerde SQL-proef geslaagd; geen publicatie of echte deletes.
- [x] Ledencontactverwijdering server-side saga + DB-writeguards; gekoppelde UUID, gedeelde/beschermde accounts blokkeren, waarschuwingen, oude JWT REST/RPC/Storage deny en Auth soft-delete voor historiebehoud.
- [x] 25 gerichte tests + geïsoleerde SQL-asserties geslaagd; migratie 0069 toegepast, live 0 operaties/intrekkingen/verwijderingen. Frontend niet gepubliceerd; echte destructieve ketentest bewust niet uitgevoerd.

## Outlook-taakdeadlines (geen publicatie)
- [x] Gerichte enable/armed-bug: transactionele bestaande configure in installatiescript, server/UI-installatiecontrole; echte isolated SQL-rollback, 8 adapter + 8 componenttests en tsgo --noEmit geslaagd; geen live installatie.
- [x] Automatische servercode/installatiescript: gedeelde engine/claim, veilig uit; 98 regressietests, echte geïsoleerde route+SQL/mock Graph/concurrency, SQL-rollback, 2 schermtests en tsgo --noEmit geslaagd.
- [ ] Veilige schedulerinstallatie: database-tool blokkeert secret-DDL (Agent access to secrets is not allowed); bestaande Vault-naam beschikbaar, script geïsoleerd getest, geen live installatie of activatie.
- [x] Deadline-engine, beveiligde outbox en beheerstatus gebouwd; 89 engine/regressietests, 2 componenttests, echte geïsoleerde SQL/gelijktijdige claim en DB→mock Graph→finish-ketentest geslaagd; 390px/desktop gecontroleerd. Review: docs/outlook-deadlines-review.md. Standaard uit, geen backfill of Microsoft-schrijfacties.
- [ ] Live Calendar-leestoegang en releasevoorwaarden: Calendars.ReadWrite en Tasks.ReadWrite.All tokenrechten bevestigd; mailboxread geblokkeerd door 0 bevestigde mappings. Activatie/releasegate blijft uit tot juiste mapping, pilot en volledige release review; unknown/conflict handmatig herstel nog niet ingebouwd; geplande dispatcher-code gereed maar installatie apart geblokkeerd.

## Open
- [ ] Projectmail (RCF) via info@: gebouwd, 17 tests + DB-beveiligingsproef geslaagd, codes toegekend; staat UIT — wacht op Microsoft-applicatierecht Mail.Read (beheerderstoestemming, beperkt tot info@) (automatische planning geïnstalleerd, uit) en daarna één echte testmail + publicatie.
- [ ] Declaratiepush naar Simone + Bernard (bernard@coffeeshopbond.nl): gebouwd en getest, staat UIT; wacht op review + activatie en publicatie.
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

- [ ] Wachtwoordresetmails terug naar Resend — geblokkeerd: Lovable Cloud ondersteunt geen Resend/SMTP voor inlogmails; keuze gebruiker nodig
