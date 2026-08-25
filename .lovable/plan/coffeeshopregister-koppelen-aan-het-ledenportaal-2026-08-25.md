# Coffeeshopregister koppelen aan het ledenportaal

Het register uit "Coffeeshopbeleid" (601 coffeeshops, 342 gemeenten) wordt in dit project overgenomen,
gekoppeld aan de leden en getoond op een aparte pagina die alleen voor bestuur en admins toegankelijk is.

## Wat je krijgt

**Nieuwe pagina "Coffeeshopregister" (alleen bestuur/admin)**
- Zoek- en filterbalk: naam, plaats, gemeente, provincie, status (actief/verlengd/vervallen), en "wel/niet aangesloten".
- Tabel met per coffeeshop: naam, adres, plaats, gemeente, vergunninghouder/exploitant, vergunningnummer, einddatum en een badge "Aangesloten lid" of "Niet aangesloten".
- Detailvenster per coffeeshop: alle registervelden, de eigendoms-/UBO-keten (indien beschikbaar), gerelateerde shops en de gekoppelde ledeninformatie.
- Bovenaan telkaarten: totaal aantal coffeeshops in Nederland, aantal aangesloten bij de bond, dekking in procenten, en het aantal gemeenten met coffeeshops.

**Koppeling met leden**
- Automatische matching op shopnaam + plaats en op adres (straat/huisnummer/postcode), met een zekerheidsscore.
- Voorstellen komen in een lijst "Te bevestigen koppelingen"; bestuur bevestigt of verwerpt met één klik.
- Handmatig koppelen blijft mogelijk: zoek een lid en koppel het aan een registershop (en andersom).
- Bevestigde koppelingen blijven staan bij elke synchronisatie; automatische voorstellen overschrijven ze nooit.
- Op de ledendetailpagina komt een blokje "Gelieerde coffeeshops" met de gekoppelde registervermeldingen.

**Landelijk aantal overal uit het register**
- Vertegenwoordiging, gemeentepagina's en statistieken rekenen voortaan met het live registeraantal in plaats van het vaste getal.
- Per gemeente wordt het aantal registershops gebruikt als noemer voor de dekking.

**Automatische verversing**
- Elke nacht haalt de app het register opnieuw op; ook een knop "Register verversen" voor admins.
- Zichtbaar wanneer de laatste synchronisatie was en hoeveel records zijn bijgewerkt.

## Voorwaarde: beveiligd eindpunt in Coffeeshopbeleid

De openbare gegevens (naam, adres, plaats, vergunninghouder, exploitant, vergunningnummer, data) zijn nu al leesbaar.
De UBO-/eigendomsketen is bewust afgeschermd en kan niet vanaf hier worden gelezen. Daarvoor is één toevoeging
nodig **in het project Coffeeshopbeleid** (niet in dit project uit te voeren):

Een read-only eindpunt `/api/public/hooks/bcd-register-export` dat:
- alleen antwoordt met een geldige header `x-bcd-secret` (gedeeld geheim, per project opgeslagen),
- per coffeeshop de registervelden plus de gemeente en de `ubo_keten`-rijen teruggeeft,
- met paginering werkt en verder niets muteert.

Ik lever de exacte opdrachttekst aan die je in dat project kunt plakken. Daarna sla je hier hetzelfde geheim op
als `COFFEESHOPBELEID_API_SECRET` en werkt de synchronisatie inclusief UBO. Zolang dat eindpunt er nog niet is,
draait alles al op de openbare registergegevens en blijft alleen het UBO-blok leeg.

## Technisch

- **Nieuwe tabellen** (alleen leesbaar voor bestuur/admin, schrijven via service role):
  - `coffeeshop_register` — bronrecord met `bron_id` (uuid uit het andere project), naam, adres, postcode, plaats, gemeente, provincie, coördinaten, exploitant, vergunninghouder, vergunningnummer, status, datums, `raw` jsonb, `synced_at`.
  - `coffeeshop_register_ubo` — eigendomsketen per registershop (niveau, naam, kvk, soort, is_uiteindelijk, betrouwbaarheid).
  - `coffeeshop_member_links` — `register_id`, `member_id`, `match_score`, `match_reden`, `status` ('voorstel' | 'bevestigd' | 'afgewezen'), `bevestigd_door`, `bevestigd_op`; uniek per (register_id, member_id).
  - `coffeeshop_register_sync_state` — laatste run, aantallen, foutmelding.
- **Edge Function `sync-coffeeshopregister`**: haalt paginerend `coffeeshop_vergunningen` + `gemeenten` op via de publieke REST van het andere project; als `COFFEESHOPBELEID_API_SECRET` is ingesteld gebruikt hij het beveiligde eindpunt inclusief UBO. Upsert op `bron_id`, verwijdert vervallen bronrecords niet maar markeert ze. Daarna draait de matcher die nieuwe voorstellen aanmaakt (bestaande bevestigde links onaangeroerd).
- **Matching**: genormaliseerde vergelijking (lowercase, leestekens/`coffeeshop` weg) op naam+plaats (score 0.9), postcode+huisnummer (0.95), alleen naam binnen dezelfde gemeente (0.6). Onder 0.6 geen voorstel.
- **Cron**: `pg_cron` dagelijks, plus RPC `trigger_coffeeshopregister_sync()` voor de knop (admin-check, `x-internal-secret`, zelfde patroon als `trigger_topical_sync`).
- **Frontend**: `src/pages/CoffeeshopRegisterPage.tsx` + route `/coffeeshopregister` achter een bestuur/admin-guard, menu-item in `AppSidebar.tsx` binnen het bestaande `(isAdmin || isBoard)`-blok, hook `src/hooks/useCoffeeshopRegister.ts`, componenten voor de tabel, het detailvenster en de bevestigingslijst.
- **Aantallen**: `MarktaandeelPage.tsx`, `GemeentenOverzicht.tsx` en de statistieken lezen het totaal en de per-gemeente-aantallen uit `coffeeshop_register` met een terugval op de huidige waarden als het register nog leeg is.
