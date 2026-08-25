# Register-koppelingen sluitend maken

Doel: het aantal bevestigde registerkoppelingen is exact gelijk aan het aantal vertegenwoordigde coffeeshops in het ledenbestand.

## Huidige stand (gemeten)

- 131 bevestigde koppelingen, 0 openstaande voorstellen.
- 164 locatierijen bij leden en leads (159 in de UI-telling na dedupe van omgezette leads).
- 33 locaties zonder koppeling, verdeeld over 28 leden/leads. Grote posten: Hunters (6/8), The Plug Utopia (4/6), Boere Jongens (4/5), Greenhouse (3/5), Siberië (3/4).
- 13 daarvan zijn eenmanslocaties zonder enige koppeling, waaronder 5 leads (Purple Rain, Toermalijn, Coffeeshop Freak, De Kruidenier, Simone van Breda).

## Aanpak

**1. Teleenheid gelijktrekken**
Eén definitie voor beide kanten van de vergelijking: een vertegenwoordigde coffeeshop is een locatierij met adres of plaats. Leads met een echte shop tellen mee; administratieve leads zonder locatie (bijv. Simone van Breda) niet. De fallback "minimaal 1 locatie" vervalt in de koppel-telling, zodat een lid zonder ingevulde locatie geen fantoom-gat oplevert.

**2. Ronde automatische matching op de resterende locaties**
De sync matcht nu vanuit het register naar leden. Daar komt een tweede ronde bij die vanuit elke ongekoppelde ledenlocatie zoekt: eerst op postcode + huisnummer, dan op genormaliseerde naam binnen dezelfde gemeente, dan op KvK/vergunninghouder. Score >= 0.9 wordt automatisch bevestigd, 0.6–0.89 komt als voorstel bij Goedkeuringen.

**3. Controlelijst afwerken**
De kaart "Aansluiting op het register" op de Locaties-pagina toont wat er na de automatische ronde overblijft, met per locatie de beste registersuggesties en de knop "Niet in register" voor shops die er echt niet in staan (gesloten, nieuwe vergunning, afhaalpunt). Gemarkeerde locaties tellen apart, zodat het verschil naar nul kan.

**4. Bewaking**
De kaart wordt groen zodra koppelingen + markeringen gelijk zijn aan het aantal locaties. Wijkt het af, dan blijft de waarschuwing staan met het exacte verschil. Ook vervallen registervermeldingen met een bevestigde koppeling worden gemeld, zodat een gesloten shop niet stil blijft meetellen.

## Technisch

- `supabase/functions/sync-coffeeshopregister/index.ts`: tweede matchronde vanuit ledenlocaties (postcode+huisnummer 0.95, naam+gemeente 0.8, KvK 0.95, vergunninghouder/exploitant 0.85); voorstellen alleen binnen dezelfde gemeente.
- Registerkoppelingen worden per locatie vastgelegd: `coffeeshop_member_links` krijgt een optionele `location_key` zodat bij leden met meerdere shops duidelijk is welke locatie gekoppeld is (nu wordt alleen op lidniveau geteld).
- `src/components/register/RegisterCoverageCard.tsx`: telling op basis van `location_key` in plaats van de huidige heuristische toewijzing; statusbadge groen/oranje.
- `src/lib/locationCount.ts`: de min-1 fallback wordt alleen nog voor weergave gebruikt, niet voor de koppel-telling.
- Data-opschoning: leads zonder echte locatie krijgen een lege `locaties`-lijst, zodat ze buiten de telling vallen.
