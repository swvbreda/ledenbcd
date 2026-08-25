# Register automatisch koppelen + UBO's in het ledenbestand

## Wat ik heb gecontroleerd

- Koppelingen nu: 90 bevestigd, 47 voorstel, 5 afgewezen. Alle matches worden als "voorstel" weggeschreven, ook de zekere (adresmatch 95%).
- UBO-tabel `coffeeshop_register_ubo` is **leeg** (0 rijen), laatste sync meldt "ok (openbaar, zonder UBO)". De openbare bron-tabel `ubo_keten` geeft 0 rijen terug; de UBO-keten komt alleen via het beveiligde export-eindpunt van Coffeeshopbeleid, waarvoor het geheim `COFFEESHOPBELEID_API_SECRET` nodig is (staat nu niet ingesteld).
- Verrijking naar leden (`enrich-members-from-register`) vult wel adres/postcode/KvK/oprichtingsdatum aan, maar doet niets met eigendom/UBO.

## Wat ik ga bouwen

### 1. Automatisch koppelen bij hoge zekerheid
- Matches met score ≥ 0,9 (adres: postcode + huisnummer, of naam + plaats) worden direct als **bevestigd** opgeslagen, met matchreden erbij — geen handmatige actie meer nodig.
- Extra veiligheidsregel: alleen automatisch koppelen als de match uniek is (één shop ↔ één lidlocatie). Bij twee even goede kandidaten blijft het een voorstel.
- Twijfelmatches (0,6–0,89, meestal "alleen naam") blijven voorstel.

### 2. Twijfelgevallen naar Goedkeuringen
- Nieuwe sectie "Registerkoppelingen" op de Goedkeuringen-pagina met alle openstaande voorstellen: shopnaam, adres, matchreden en zekerheid, naast de gegevens van het voorgestelde lid.
- Per rij: Koppelen / Afwijzen, plus doorklik naar het coffeeshopregister voor het vergelijkingsvenster.
- De teller in de hero telt deze voorstellen mee.

### 3. UBO's in het ledenbestand
- Verrijking uitbreiden: per gekoppelde locatie worden **vergunninghouder/exploitant** en de **eigendomsketen (UBO)** meegenomen naar het lid (veld `ubo` per locatie: naam, KvK, niveau, uiteindelijk belanghebbende ja/nee), en zichtbaar op het lidprofiel bij de locatie.
- Lege velden worden gevuld; afwijkende waarden komen als voorstel bij de bestaande verrijkingsgoedkeuringen.
- Zolang de UBO-bron leeg is, vult dit alleen vergunninghouder/exploitant + KvK. Om de echte eigendomsketen binnen te halen heb ik het geheim `COFFEESHOPBELEID_API_SECRET` van het Coffeeshopbeleid-project nodig; zodra dat is ingesteld haalt de sync de UBO-keten op en verrijkt hij de leden automatisch.

## Technisch

- `supabase/functions/sync-coffeeshopregister/index.ts`: status `bevestigd` bij score ≥ 0,9 + uniciteitscheck.
- `supabase/functions/enrich-members-from-register/index.ts`: UBO/eigendom-velden toevoegen aan locatie-verrijking en voorstellen.
- `src/pages/GoedkeuringenPage.tsx` + hook in `src/hooks/useCoffeeshopRegister.ts`: sectie met openstaande registervoorstellen (hergebruikt `useSetRegisterLink`).
- Eenmalige opschoning: bestaande 47 voorstellen met score ≥ 0,9 direct op bevestigd zetten.
