# Betere koppelvoorstellen: geen shops uit een andere gemeente meer

## Wat er misgaat

De automatische matching kent drie regels. De derde regel, "Alleen naam" (60%), vergelijkt uitsluitend de shopnaam en negeert de plaats volledig. Daardoor wordt Coffeeshop Smokey aan het Spui in Den Haag voorgesteld aan lid #87 Coffeeshop Smokey in Amsterdam. Van de 2 openstaande voorstellen komen beide uit deze regel; alle 131 bevestigde koppelingen komen uit de sterkere regels (adres of naam+plaats).

Daarnaast wordt er nu niets gedaan met bedrijfsgegevens: het register bevat vergunninghouder, exploitant en voor 78 shops een KvK-nummer, terwijl 86 leden een KvK-nummer hebben. Die informatie blijft ongebruikt, terwijl juist die de zekere match oplevert bij shops met een afwijkende handelsnaam. De UBO-tabel is nog leeg (die vult pas als het beveiligde register-eindpunt beschikbaar is), dus UBO wordt als bron voorbereid maar levert voorlopig nog geen matches.

## Wat er verandert

- **Naam-alleen matches krijgen een plaatsgrens**: een voorstel op alleen de naam wordt niet meer gemaakt als de gemeente van de shop en de plaats van het lid duidelijk verschillen. Ligt de shop in dezelfde of een aangrenzende plaats/gemeente, dan blijft het een voorstel ter controle.
- **Matchen op bedrijf (BV) en KvK**:
  - Gelijk KvK-nummer tussen register en lid (op lidniveau of op locatieniveau) = 95%, direct bevestigd.
  - Vergunninghouder of exploitant komt overeen met de bedrijfsnaam of factuurbedrijfsnaam van het lid = 85%, als voorstel ter goedkeuring.
  - Dezelfde bedrijfsnaam als bij een al bevestigde koppeling van hetzelfde lid (kettingen/meerdere shops onder één BV) = 80%, als voorstel.
- **UBO als extra signaal**: zodra de UBO-keten gevuld is, telt een overeenkomende UBO-naam of UBO-KvK mee als voorstel (75%). Levert nu nog niets op, maar werkt automatisch mee zodra de data binnenkomt.
- **Reden wordt specifieker**: in Goedkeuringen zie je precies waarop gematcht is ("KvK 12345678", "Exploitant: Riemer BV", "Naam + plaats") in plaats van alleen "Alleen naam".
- **Opschonen**: de 2 bestaande onterechte naam-alleen voorstellen over gemeentegrenzen worden verwijderd.

## Technisch

- `supabase/functions/sync-coffeeshopregister/index.ts`: het scoringblok (regels ~250-313) wordt uitgebreid. Kandidaten krijgen extra velden (`kvk`, `bedrijfsnaam`, `factuurBedrijfsnaam`, `gemeente`), de shopquery haalt ook `kvk_nummer`, `vergunninghouder` en `exploitant` op, plus een lookup op `coffeeshop_register_ubo`. Bedrijfsnamen worden genormaliseerd (rechtsvormsuffixen b.v./bv/v.o.f./holding weggestript) voor de vergelijking.
- Naam-alleen regel krijgt een plaatsfilter: alleen toestaan als `normPlace(shop.gemeente)` gelijk is aan de plaats of gemeente van het lid.
- Auto-bevestigen blijft op score >= 0.9 met unieke kandidaat; KvK-match (0.95) valt daar automatisch onder.
- Eenmalige opruimactie via SQL voor de bestaande voorstellen met `match_reden = 'Alleen naam'` waarvan de gemeente afwijkt.
