# Piramide verschijnt bij zoeken op "Hilversum"

## Wat er aan de hand is (geverifieerd)

Lid #97 Piramide heeft:
- shoplocatie: Kapelstraat 43-A, **1404 HW Bussum** (klopt)
- basisgegevens `plaats`: Hilversum (verouderd, wordt al overruled door de bewerking naar Bussum)
- **factuuradres**: Kapelstraat 43a, 1404 HW — maar met plaats **Hilversum** (foutief; postcode 1404 HW hoort bij Bussum)

Zoeken op een plaatsnaam mag geen lid opleveren waarvan alleen het factuuradres in die plaats staat.

## Wat ik ga doen

1. **Foutief factuuradres corrigeren**: factuurplaats van Piramide (#97) op "Bussum" zetten, en de verouderde `plaats: Hilversum` in de basisgegevens gelijktrekken naar Bussum. Zo klopt ook de factuur uit Informer.
2. **Zoeken op plaats/gemeente beperken tot echte vestigingen**: de plaatsnaam-match gebeurt alleen op de vestigingsplaats en de locaties, niet op factuurplaats/factuurpostcode. Zoeken op bedrijfsnaam, e-mail, telefoon en lidnummer blijft ongewijzigd.

## Technisch

- Data-update op `members_data` (#97) en `member_edits` (#97): `plaats` en `factuurPlaats` naar "Bussum" (overige velden ongemoeid, fetch-and-merge).
- `src/hooks/useMembers.ts`: geen match meer op factuuradresvelden bij plaatsnaam-zoekopdrachten.
