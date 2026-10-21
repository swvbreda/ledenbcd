# Outlook-taakdeadlines — review, niet publiceren

## Implementatie
- `src/lib/outlookDeadlines.ts`: operationele lifecycle met minimale tekst/backlink, hele-dag Europe/Amsterdam, exclusieve volgende kalenderdag, vrij en popup uit. Taak blijft bron; geen beschrijvingen/deelnemers.
- `outlookDeadlineGraph.server.ts`: bestaande Graph-config/origin, ImmutableId, If-Match, geen retries van writes. Alleen bekende event/account/calendar-combinaties; externe gewijzigde ETag, ontbrekend transactionId, deelnemers of meeting/recurrence geeft conflict.
- `outlookDeadlines.functions.ts`: huidige adminrol via caller-RLS; serverreleasegate `OUTLOOK_DEADLINES_RELEASED=true` vereist voor activatie én dispatcher. Configureren/finish alleen via service RPC met gecontroleerde adminactor. Maximaal 10 claims/2 minuten per expliciete verwerking.
- `OutlookDeadlinesPanel.tsx` in bestaand Plannerpaneel: uitgeschakelde activatie, mappingtelling, privéstatussen, expliciete verwerking. Geen dispatch op openen of afronden.
- Migraties `0058_outlook_task_deadlines.sql`, `0059_outlook_deadline_no_mapping_backfill.sql`: private instellingen/outbox, RLS admin-only SELECT, anon/PUBLIC geen rechten, authenticated geen writes/TRUNCATE, service alleen SELECT/INSERT/UPDATE. Task/project/mapping-triggers, SKIP LOCKED claim, revision/lease checks, verloren leases uncertain. Mappingbevestiging verwerkt alleen reeds gevolgde taken, geen backfill.
- Afronden blijft `completeTaskLocally`, geheel zonder Graph. DB-trigger zet toekomstige afhandeling klaar. Accountwissel verwijdert eerst bewezen oud event; pas volgende claim maakt nieuw accountitem met nieuw transactionId.

## Bewijs
- 24 engine/adaptertests: DST maart/oktober, free/all-day, popup uit, minimale body, mapping, ownerwissel, afronden/deadlineweg/archive, externe conflicten, 412, 403, timeouts zonder tweede POST.
- 89 geselecteerde tests geslaagd inclusief bestaande Planner (38), Topical (23), lokale afronding (4).
- 2 componenttests: standaard uit, geen dispatch bij openen, onbekende uitkomst zichtbaar.
- `supabase/tests/outlook_deadlines.sql`: echte migraties byte-exact geladen op lokale Postgres 17.9, poort 55441/socket, rollbacktests voor anon/auth rechten, nonadminweigering/adminread, mapping, no-backfill, stale revision, late-success-idbehoud, lease expiry, onbekend niet herclaimen, lokale finish en archivering/pauze. Basisfixture bevat alleen minimaal schema/auth/has_role; geen productiedata of notificatiefuncties.
- `outlook_deadlines_concurrency.sh`: twee simultane SQL-verbindingen -> één claimed job.
- `outlookDeadlinesDb.test.ts`: daadwerkelijke claim -> mock Graph create -> service finish -> lokale afronding -> mock delete -> uitlezen removed; 1 test geslaagd, geen externe netwerkcalls. Opt-in `OUTLOOK_FIXTURE_TEST=true`, vaste lokale socket, nooit production URL.
- Playwright: geïsoleerde queryfixture op desktop 1280x1800 en 390x844, geen horizontale overflow/runtimefout, controls disabled. Screenshots onder `/tmp/browser/outlook-deadlines`. Geen auth-bypass ingebouwd; geen echte ingelogde accountflow gecontroleerd.
- Automatische appbuild: build OK. Geen handmatige typecheck gestart (platformcontrole); afzonderlijk typecheckresultaat niet beschikbaar.
- Read-only tokencheck: Calendars.ReadWrite en Tasks.ReadWrite.All aanwezig (losse rechten). Geen tokens opgeslagen/geprint. Calendartoegang per daadwerkelijke eigenaar niet bewezen: 0 bevestigde mappings.
- Live read-only baseline na schema: 48 taken, 19 agenda-items, 0 mappings, 0 outbox, enabled=false. Geen echte taak/agenda/rol/bericht-mutatie, geen activering of publicatie.

## Open vóór activatie
1. Expliciet juiste verantwoordelijke Microsoft-accountmapping bevestigen; huidige mappings=0.
2. GET van die eigen agenda moet id/canEdit aantonen. Tokenpermission is niet voldoende bewijs voor mailbox access.
3. Volledige release-scope review; serverreleasegate blijft afwezig/false. Geen automatische scheduler toegevoegd: outbox wordt onafhankelijk na opslag verwerkt via expliciete beheeractie; geplande achtergrondverwerking vraagt een afzonderlijk gereviewde aanroep.
4. Unknown/conflict blijft veilig geblokkeerd, geen automatische recreatie. Handmatige herstelkeuze/adoptie is nog niet ingebouwd; niet omzeilen met titelmatching.
5. Geen echte Graph create/update/delete uitgevoerd: productie roundtrip, Microsoft transactionId-retentie/ETag-conditional writes en werkelijk all-day gedrag moeten tijdens expliciet goedgekeurde pilot worden bewezen.
6. Racegrens: lease/revision wordt direct vóór elke write hercontroleerd; een wijziging tussen die check en Microsoft response kan kort een oude datum tonen. Finish bewaart het bewezen event-id en zet nieuwere revision pending; onbekend resultaat blokkeert veilig.

## Microsoft-documentatie
- https://learn.microsoft.com/en-us/graph/api/resources/event?view=graph-rest-1.0
- https://learn.microsoft.com/en-us/graph/api/calendar-post-events?tabs=http&view=graph-rest-1.0
- https://learn.microsoft.com/en-us/graph/api/event-update?view=graph-rest-1.0
