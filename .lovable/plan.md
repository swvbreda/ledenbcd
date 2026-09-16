# Controle: worden coffeeshops dubbel geteld?

## Wat ik heb gevonden

Het landelijke register zelf is schoon: 596 actieve shops, geen enkele shop staat er twee keer in.

De dubbeltelling zit in het ledenbestand. Van de 143 bevestigde registerkoppelingen komt geen dubbel voor, maar de vestigingen die *niet* aan het register gekoppeld zijn worden er los bij opgeteld — en daar staan echte duplicaten tussen:

- Zes leden hebben dezelfde vestiging twee of drie keer in hun lijst staan:
  - Hunters — Utrechtsestraat 14 (3x)
  - Boere Jongens — Rumberweg 2 (2x)
  - Coffeeshop Paradox — 1e Bloemdwarsstraat 2 (2x)
  - Kadinsky — Langebrugsteeg 7a (2x)
  - The Plug (Utopia) — 1e Oosterparkstraat 47 (2x)
  - Bullwacki — Noestduinstraat 76 (2x)
- Eén vestiging staat bij twee verschillende leden: 1e Oosterparkstraat 47 bij zowel "The Plug (Utopia)" als "The Plug East".

Samen zijn dat circa 8 shops die dubbel meetellen in het getal op het dashboard.

## Wat ik wil doen

1. **Controlelijst maken (eerst kijken, niets wijzigen).** Een overzicht van alle dubbele vestigingen per lid en van vestigingen die bij meerdere leden staan, zodat jij per geval kunt bevestigen dat het echt om dezelfde shop gaat.
2. **Opschonen na jouw akkoord.** Per bevestigd geval de dubbele vestigingsregel verwijderen bij het lid (de gegevens van de overblijvende regel blijven volledig intact), en bij The Plug bepalen welk lid de vestiging houdt.
3. **Telling dubbeldicht maken.** De berekening achter "aangesloten coffeeshops" ontdubbelt straks zelf op adres+postcode, zodat een per ongeluk dubbel ingevoerde vestiging het getal nooit meer kan opblazen — ook niet bij toekomstige invoer.
4. **Verschil narekenen.** Het dashboard toont nu 184; mijn hercontrole op de opgeslagen ledengegevens komt op 174. Het verschil komt vermoedelijk uit nog niet goedgekeurde ledenwijzigingen die wel al meetellen. Dat zoek ik uit en trek ik recht, zodat de kaart en de kerngegevens exact hetzelfde getal laten zien.

## Technisch

- `get_representation_stats()` telt bevestigde registerkoppelingen plus de niet-gematchte vestigingen uit `members_data`/`member_edits` (via `merge_member_locations`). Er is nog geen ontdubbeling op adresniveau binnen één lid of tussen leden.
- Wijziging: in de `member_locations`-CTE ontdubbelen op genormaliseerd adres+postcode (`DISTINCT ON`), en in `represented` een globale ontdubbeling per adres over leden heen.
- De opschoning van de ledendata gaat via een migratie op `members_data.data->'locaties'`, alleen voor de expliciet bevestigde gevallen — nooit generiek over alle leden.
- Na afloop `apply_member_register_opgave` draaien voor de geraakte leden, zodat de registeropgave met de opgeschoonde vestigingen meebeweegt.
