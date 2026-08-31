# Koppeling met de Beleidsmonitor afmaken

Doel: ledenlijst dagelijks naar de Beleidsmonitor sturen, verrijkte dossiers terughalen, en de status hiervan zichtbaar maken in het beheer.

## 1. Sleutels gelijktrekken

Twee gedeelde sleutels worden opgevraagd via het beveiligde secret-formulier (waarden plak je zelf, exact zoals in de Beleidsmonitor):

- `REGISTER_PUSH_SECRET` — de bestaande functie `register-changed` geeft nu 401 omdat deze waarde afwijkt.
- `BCD_KOPPEL_SLEUTEL` — nieuw, voor de ledensynchronisatie.

Na het invullen wordt `register-changed` opnieuw uitgerold en getest.

## 2. Ledenlijst versturen (nieuwe functie `beleidsmonitor-sync`)

- Leest alle actieve leden (`members_data`, type `member` en `lead`) en klapt ze uit per vestiging.
- Per regel: eigen uniek id (`lid-<id>` of `lid-<id>-<vestigingssleutel>`), naam, KVK-nummer, vestigingsnummer (uit het coffeeshopregister waar gekoppeld), adres, postcode, plaats en e-mail.
- Verstuurt in batches van maximaal 5.000 naar
  `POST https://beleidsmonitor.lovable.app/api/public/hooks/leden-sync`
  met header `x-bcd-sleutel` en body `{ "leden": [ ... ] }`.
- Logt per run: tijdstip, aantal verstuurd, aantal batches, HTTP-status en de exacte foutmelding.

## 3. Dossiers ophalen

- Zelfde functie, stap 2: `GET https://beleidsmonitor.lovable.app/api/public/leden-dossier` met dezelfde header (optioneel `?extern_id=` voor één lid).
- Per lid/vestiging worden gekoppelde vergunning, dossierstatus en coffeeshopgegevens opgeslagen in een nieuwe tabel `beleidsmonitor_dossiers` (alleen leesbaar voor bestuur/admin).

## 4. Statusblok in het beheer

Nieuw blok op de Coffeeshopregister-pagina (bestuur/admin):

- Laatst verstuurd + aantal leden/batches
- Laatst opgehaald + aantal dossiers
- Laatste foutmelding, letterlijk weergegeven
- Knop "Nu synchroniseren" die beide stappen direct draait

## 5. Dagelijkse automatische run

Een dagelijkse geplande taak (04:30) roept `beleidsmonitor-sync` aan, in lijn met de bestaande automatische syncs.

## Technische details

- Nieuwe edge function `supabase/functions/beleidsmonitor-sync/index.ts`, `verify_jwt = false`, met eigen auth-check: alleen service_role of een ingelogde admin/bestuurder mag handmatig starten.
- Nieuwe tabellen: `beleidsmonitor_sync_state` (één rij: tijdstippen, aantallen, laatste fout) en `beleidsmonitor_dossiers` (extern_id, lid_id, vergunning, status, shopgegevens, jsonb payload). Beide met GRANTs en RLS: lezen voor `authenticated` met bestuurs-/adminrol, schrijven alleen service_role.
- Nieuwe hook `useBeleidsmonitorSync.ts` + component `BeleidsmonitorSyncCard.tsx`.
- Planning via `pg_cron`, zoals de bestaande register- en Informer-syncs.
