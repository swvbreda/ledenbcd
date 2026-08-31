# Beleidsmonitor-koppeling afronden

## Stand van zaken
Beide sleutels staan al opgeslagen in de beveiligde opslag van dit project:
`REGISTER_PUSH_SECRET` en `BCD_KOPPEL_SLEUTEL`. Ik hoef ze dus niet opnieuw te
ontvangen, en ik kan de waarden zelf niet inzien (dat is met opzet zo).

De koppeling zelf is gebouwd en actief:
- dagelijkse push van de ledenlijst in batches van 5.000 met header `x-bcd-sleutel`
- ophalen van verrijkte dossiers
- statusblok met knop "Nu synchroniseren" bovenaan het Coffeeshopregister

De laatste testrun mislukte niet op de sleutel, maar op het adres: het aangeleverde
webadres beantwoordt de twee endpoints nog niet.

## Wat er nog moet gebeuren

1. **Sleutel opnieuw invoeren (alleen als je twijfelt)**
   Als je niet zeker weet of de opgeslagen `REGISTER_PUSH_SECRET` exact gelijk is aan
   die in de Beleidsmonitor, open ik het beveiligde formulier zodat je hem opnieuw
   plakt. Overschrijven is risicoloos.

2. **Werkend adres vaststellen**
   Instelbaar maken/zetten van het basisadres van de Beleidsmonitor, zodra bekend is
   waar de endpoints draaien.

3. **Testrun en controle**
   Sync handmatig starten en in het statusblok controleren of push (aantal leden) en
   pull (aantal dossiers) slagen; foutmelding tonen als iets misgaat.

## Technische details
- Edge function: `supabase/functions/beleidsmonitor-sync/index.ts`
- Basisadres via instelling `BELEIDSMONITOR_BASE_URL` (nu: `https://coffeeshopbeleid.lovable.app`)
- Endpoints: `POST /api/public/hooks/leden-sync`, `GET /api/public/leden-dossier`
- Status/geschiedenis: tabellen `beleidsmonitor_sync_state` en `beleidsmonitor_dossiers`
- Dagelijkse cron om 04:30 via `trigger_beleidsmonitor_sync()`
