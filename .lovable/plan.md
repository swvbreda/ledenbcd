# WhatsApp-koppelingen herstellen en beschermen

## Wat er is gebeurd

De upload van vanavond (20:17) heeft bij 152 deelnemers de koppeling met het lid gewist. Oorzaak: de import werkt bestaande deelnemers bij op telefoonnummer en schrijft daarbij álle velden over — ook `lidnummer`. Omdat de nieuwe CSV geen lidnummer-kolom bevatte, werd elke bestaande koppeling overschreven met "leeg".

Controle in de database bevestigt dit: die 152 rijen bestaan al sinds juni, maar zijn allemaal om 20:17 vandaag bijgewerkt en hebben nu geen lid meer.

## Wat we gaan doen

### 1. Import mag nooit meer gegevens wissen
Bij het bijwerken van een bestaande deelnemer worden lege waarden uit de CSV genegeerd. Een bestaande koppeling, notitie of naam blijft staan als de CSV die kolom niet bevat of leeg laat. De import vult alleen aan of overschrijft met een échte waarde.

### 2. Automatisch koppelen op telefoonnummer én naam
Nieuwe koppelfunctie die bij import en via een knop "Automatisch koppelen" draait:
- **Telefoonnummer** (laatste 9 cijfers) tegen hoofdtelefoon en alle contactpersonen van leden — dit is een zekere match en wordt direct toegepast.
- **Naam** (WhatsApp-weergavenaam zonder `~`) tegen contactpersoonsnamen en bedrijfsnamen van leden — dit is een waarschijnlijke match en wordt als voorstel getoond, dat je per stuk of in bulk kunt bevestigen.

### 3. Herstel van de 152 verbroken koppelingen
Directe herstelronde op de huidige data:
- Telefoonmatch levert nu 1 zekere koppeling op (de nummers uit de community staan grotendeels niet in de ledenprofielen).
- Naammatch levert circa 56 voorstellen op die je met één klik kunt bevestigen.
- De rest blijft in de lijst "vereist actie" staan, zoals nu.

Volledig automatisch herstel van alle 152 is niet mogelijk: de vorige koppelingen zijn overschreven en er is geen historie van bewaard. Daarom worden waar mogelijk voorstellen gedaan in plaats van gokken.

### 4. Beschermen tegen herhaling
- Een waarschuwing in het uploadscherm zodra de CSV geen lidnummer-kolom heeft: "Bestaande koppelingen blijven behouden."
- De preview toont per rij wat er gebeurt (nieuw / bijwerken / koppeling blijft behouden).

## Technisch

- `src/components/CommunityUploadDialog.tsx`: update-payload wordt opgebouwd met alleen niet-lege velden; `member_id` en `note` worden nooit op `null` gezet vanuit een ontbrekende kolom.
- Nieuwe helper `src/lib/communityMatch.ts`: `matchParticipants(participants, members)` geeft `{ certain, suggested }` op basis van genormaliseerd telefoonnummer (`normalizePhone`, laatste 9 cijfers) en genormaliseerde naam (lowercase, `~`-prefix weg, diacrieten weg, substring-match op contactnaam/bedrijfsnaam).
- `src/components/CommunityTodoList.tsx`: knop "Automatisch koppelen" die zekere matches wegschrijft naar `whatsapp_participants.member_id` en een voorstellenblok toont met per rij "Bevestigen" plus "Alles bevestigen".
- Geen schemawijziging nodig.
