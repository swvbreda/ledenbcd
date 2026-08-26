# Dubbele vestiging opruimen + lege velden verbergen

## Wat er speelt

Bij lid Greenhouse (#5) staat Haarlemmerstraat 64 twee keer:

- "Green House United" — postcode 1013 ES, niet gekoppeld aan het register
- "Greenhouse Lounge" — postcode 1013 ET, bevestigd gekoppeld aan het register

Dat is één en dezelfde vestiging (het register kent alleen Greenhouse Lounge op dit adres), dus deze wordt nu dubbel geteld in het aantal vertegenwoordigde coffeeshops. De dubbele staat zowel in de basisgegevens (`members_data`) als in de bewerkte overlay (`member_edits`).

Daarnaast tonen de locatiekaarten lege regels met een streepje en de opmerking "UBO niet beschikbaar in het register" / "Niet gekoppeld aan het landelijke register", ook als er niets te melden is.

## Aanpak

1. **Dubbele vestiging verwijderen**
   - "Green House United" (1013 ES) verwijderen uit zowel de basisgegevens als de bewerkte gegevens van lid #5, zodat alleen "Greenhouse Lounge" (de registerregistratie) overblijft.
   - Daarna telt het lid één vestiging minder; het totaal vertegenwoordigde coffeeshops corrigeert zich automatisch via de bestaande telling.

2. **Alleen tonen wat we hebben** (`src/components/register/LocationRegisterInfo.tsx`)
   - KvK-blok: regels voor KvK-nummer, vestigingsnummer, vestigingsdatum en website alleen renderen als er een waarde is. Is het hele blok leeg, dan vervalt ook de kop "KVK".
   - Registerblok: regels Dossier, Vergunninghouder, Exploitant, Vergunning en Status alleen tonen bij een waarde.
   - De teksten "UBO niet beschikbaar in het register" en "Niet gekoppeld aan het landelijke register" verwijderen; de badge "Niet gekoppeld" blijft als enige signaal.
   - Kaarten blijven onderling uitgelijnd doordat het registerblok onderaan blijft staan.

## Technisch

- Data-opschoning via een SQL-update op `members_data.data->'locaties'` en `member_edits.data->'locaties'` voor lid 5, waarbij het element met postcode 1013 ES op Haarlemmerstraat 64 wordt gefilterd.
- `Row` in `LocationRegisterInfo` krijgt de conventie: geen waarde = niet renderen (in plaats van "—").
