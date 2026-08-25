# Aanwezigheid compacter tonen op de agendakaart

## Wat er nu misgaat
- Bij bestuursvergaderingen wordt "Bestuur aanwezig" als één lange zin met alle namen én functies tussen haakjes uitgeschreven; dat vult drie regels en oogt rommelig.
- Bij evenementen worden de aangemelde namen helemaal niet getoond, dus de presentatie is inconsistent.

## Wat ik ga doen

### 1. Bestuursvergaderingen: compacte weergave
- Eén regel: `Bestuur aanwezig · 9` met daarachter maximaal 3 namen (zonder functie) en `+6 meer`.
- Klikken op de regel klapt de volledige lijst uit als nette opsomming: naam vet, functie eronder in kleine grijze tekst, in een kolommenraster (1 kolom mobiel, 2–3 kolommen desktop).
- Namen zonder functie tonen alleen de naam; geen haakjes meer in de compacte regel.

### 2. Evenementen: aanwezigen op dezelfde manier
- Onder de meta-regel komt bij evenementen `Aangemeld · N` met dezelfde compacte/uitklapbare weergave.
- Getoond worden de ingevulde deelnemersnamen (`attendee_names`); als een aanmelding geen namen heeft, valt hij terug op de lid- of bestuursnaam.
- Zichtbaarheid volgt de bestaande regels: leden zien geen aanmeldingen van anderen, dus voor gewone leden blijft alleen de bestuursaanwezigheid plus hun eigen aanmelding zichtbaar; admins zien de volledige lijst.

## Technisch
- Alleen presentatie: nieuwe kleine component `src/components/agenda/AttendanceList.tsx` (compacte regel + `Collapsible`), gebruikt in `AgendaEventCard.tsx` voor zowel bestuur als evenement-deelnemers.
- Namen voor evenementen komen uit de al opgehaalde `registrations` (`attendee_names`, anders lidnaam); geen databasewijziging, geen wijziging aan hooks of RLS.
