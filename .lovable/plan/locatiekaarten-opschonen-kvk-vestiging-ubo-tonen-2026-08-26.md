# Locatiekaarten opschonen + KvK/vestiging/UBO tonen

## Wat er nu gebeurt

Op de leden-detailpagina staan de locatiekaarten in een grid van 2 kolommen, maar elke kaart heeft een andere hoogte en de blokken (adres, KVK, register) staan los onder elkaar zonder vaste volgorde. Daardoor lopen de kaarten visueel uit de pas, zoals op je screenshot: "The Bulldog Rockshop" toont wel een KVK-regel, de andere kaarten niet, en het REGISTER-blok begint op elke kaart op een andere hoogte.

## Wat ik ga doen

### 1. Nettere uitlijning
- Elke locatiekaart krijgt dezelfde opbouw met vaste secties: **kop** (naam + stadsdeel) → **adres** → **KvK-gegevens** → **UBO** → **Register**.
- Kaarten binnen een rij worden even hoog (flex-kolom met het registerblok onderaan vastgezet), zodat de rode "Bevestigd"-badges op dezelfde lijn staan.
- Labels links, waarden rechts in een compact tweekoloms-raster, cijfers in `tabular-nums`/mono voor KvK-nummers.

### 2. KvK- en vestigingsnummer per locatie
- De locatiekaart toont voortaan altijd het KvK-nummer en het **vestigingsnummer** van die specifieke vestiging, mits bekend. Deze komen uit het gekoppelde registerdossier (`kvk_nummer`, `kvk_vestigingsnummer`, `kvk_vestiging_datum`), met de handmatig ingevulde waarde op het lid als voorrang.
- Ontbreekt een waarde, dan toont de regel een streepje in plaats van te verdwijnen — zo blijven de kaarten uitgelijnd en zie je meteen wat nog aangevuld moet worden.

### 3. UBO tonen als we die hebben
- Onder het KvK-blok komt een compacte eigendomsketen: naam, KvK-nummer en een markering voor de uiteindelijk belanghebbende, ingesprongen per niveau.
- Bron: eerst de UBO-gegevens die al bij het lid staan, aangevuld met de UBO-keten van het gekoppelde registerdossier.
- Is er geen UBO bekend, dan verschijnt het blok niet (met bij een gekoppeld dossier de notitie "UBO niet beschikbaar").

## Stand van de gegevens (belangrijk)

Ik heb de database gecontroleerd:
- Er staan **nul UBO-regels** in het register en nul bij de leden. De registersync draait nu in de openbare modus ("zonder UBO"); de UBO-keten komt alleen binnen via het beveiligde export-eindpunt van het bronproject.
- **Nul vestigingsnummers** ingevuld: de KvK-vestigingslookup in de verrijkingsfunctie is nog niet gedraaid of leverde geen zeker resultaat.

De UI wordt dus zo gebouwd dat deze velden meteen verschijnen zodra de data er is. Wil je dat ik daarna ook de verrijking laat draaien om de vestigingsnummers op te halen, dan doe ik dat als losse stap.

## Technisch

- `src/components/register/LocationRegisterInfo.tsx`: herschrijven naar een gestructureerd label/waarde-blok, inclusief KvK-, vestigings- en UBO-regels.
- `src/hooks/useCoffeeshopRegister.ts`: `RegisterShop` uitbreiden met `kvk_nummer`, `kvk_vestigingsnummer`, `kvk_vestiging_datum`; een hook toevoegen die de UBO-ketens van meerdere registershops in één query ophaalt.
- `src/pages/MemberDetail.tsx`: locatiegrid omzetten naar gelijke kaarthoogtes (`items-stretch`, `flex flex-col`, registerblok met `mt-auto`) en het bestaande losse UBO-blok samenvoegen met het nieuwe component.
- Geen databasewijzigingen nodig; alle kolommen bestaan al.
