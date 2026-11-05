# Telefoon: ingelogd blijven en openen (5 nov 2026)

## Bewijs (alleen lezen, geen tokens)
- Server: 18 iPhone-app-sessies van 16 gebruikers, max 2 per gebruiker, 0 sessies met ingetrokken laatste token. Simones app-sessie van 22 okt is nog geldig en werd vandaag (5 nov 18:07 UTC) ververst. De server heeft haar dus niet uitgelogd; het loginscherm komt van de app zelf.
- auth-js 2.114.0 `__loadSession`: als het toegangstoken al verlopen is (na een gesloten app of meer dan 1 uur op de achtergrond) en de vernieuwing tijdelijk mislukt, bewaart de bibliotheek de sessie, maar `getSession()` en `INITIAL_SESSION` geven `session: null`. De mislukte poging wordt 60 s vastgehouden (`REFRESH_FAILURE_COOLDOWN_MS`). Bekend probleem: supabase-js issue #2748 (open, okt 2026).
- `useAuth.tsx` (oud): de listener paste `INITIAL_SESSION null` direct toe → user null → `ProtectedRoute` stuurt naar `/login`. Pas na een latere `TOKEN_REFRESHED` (ticker van 30 s, wachttijd 60 s) kwam de gebruiker terug. Dat verklaart alle drie de klachten: leeg scherm, lang laden en het loginscherm.
- Bij elke terugkeer in de app werd een vernieuwing geforceerd (`refreshSessionOnce()`), ook als het token nog geldig was. Dat is overbodig: supabase-js controleert dit zelf bij zichtbaar worden. Het geeft wel extra kans dat iOS de app pauzeert terwijl een vernieuwing nog loopt.
- Na een sessie-verlopen-melding volgde uitloggen bij elke vernieuwingsfout die niet tijdelijk was. Daar viel ook `AuthRefreshDiscardedError` onder: die fout betekent alleen dat een andere vernieuwing al gewonnen had.

## Wijzigingen
- `src/lib/sessionRestore.ts`: pure beslisregels: tijdelijk / ingehaald / ongeldig.
- `useAuth.tsx`:
  - `INITIAL_SESSION` zonder sessie wordt genegeerd; de bootstrap beslist.
  - Een tijdelijke fout of time-out toont "verbinding herstellen" zonder rechten. De app probeert het na 20 s opnieuw en ook zodra de verbinding terug is (`online`).
  - Een echte `SIGNED_OUT` of een definitieve weigering leidt naar het loginscherm.
  - Terugkeer in de app gebruikt `getSession()` en controleert de rechten daarna opnieuw vanuit de database.
  - De sessie-verlopen-melding logt alleen uit bij een definitieve weigering of als de sessie ontbreekt. Opruimen gebeurt alleen lokaal (`scope: "local"`).
  - Expliciet uitloggen is onveranderd (globaal) en de "Onthoud mij"-keuze blijft staan.
- Ledenkoppeling: `member_profiles` wordt gelijktijdig met `ensure_member_link` gelezen. Opnieuw lezen gebeurt alleen als er een koppeling bij kwam (de live functie voegt alleen toe en geeft het aantal terug). Dat is één rondgang minder op het opstartpad.

## Niet gewijzigd / beperkingen
- Native config (alleen gelezen): `server.url` = `https://leden.coffeeshopbond.nl`, splash 800 ms. Opslag gebeurt per host: wie overstapt van de oude lovable.app-host moet eenmalig opnieuw inloggen, daarna niet meer. Deze reparatie is alleen voor de website; een App Store-build is niet nodig.
- Herladen na meer dan 4 uur op de achtergrond is behouden, dus dan volgt nog steeds een volledige koude start (logo plus laden), maar niet meer het loginscherm.
- Web met "Onthoud mij" uit: `beforeunload` wist de sessie ook bij herladen. Dat is bestaand gedrag en niet aangepast.
- Niet gemeten: werkelijke tijdwinst op een iPhone. Er is geen fysieke telefoon en geen eigen sessie beschikbaar. Er worden geen tijdwinstcijfers geclaimd.
- Tests: `src/components/__tests__/AuthSession.render.tsx` (10), plus de bestaande tests voor opstarten, push, toegangsbeheer, bootstrap en invoke (21).
