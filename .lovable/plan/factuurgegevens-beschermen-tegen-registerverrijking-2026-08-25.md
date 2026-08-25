# Factuurgegevens beschermen tegen registerverrijking

Controle van de verrijkingslogica: het register schrijft nooit rechtstreeks naar `factuurBedrijfsnaam`, `factuurKvk`, `factuurEmail`, `factuurAdres`, `factuurPostcode` of `factuurPlaats`. Er zit wél een indirect risico: op ledenniveau vult de verrijking automatisch `bedrijfsnaam` en `kvk` in met de vergunninghouder/KvK uit het register, en juist die twee velden worden in het ledenprofiel als terugval gebruikt voor de facturatiegegevens ("Factuur bedrijfsnaam" toont `factuurBedrijfsnaam || bedrijfsnaam`). Daarnaast kan het goedkeuringsscherm elk voorgesteld veld wegschrijven, zonder blokkade op factuurvelden.

## Wat er gebeurt

1. **Harde blokkade op factuurvelden**
   Alle velden die met `factuur` beginnen worden uitgesloten van automatisch invullen én van voorstellen. Komt zo'n voorstel toch binnen, dan wordt het bij goedkeuren geweigerd met een duidelijke melding.

2. **Bedrijfsnaam en KvK op ledenniveau niet meer automatisch invullen**
   Deze twee gaan van "stil invullen" naar "voorstel ter goedkeuring", omdat ze de facturatie beïnvloeden. Adres-, locatie- en UBO-gegevens blijven wel automatisch aangevuld zoals nu (alleen als het veld leeg is).

3. **Waarschuwing in de goedkeuringslijst**
   Voorstellen voor `bedrijfsnaam` en `kvk` krijgen een label "beïnvloedt facturatie", zodat je bewust kiest.

4. **Bestaande gegevens controleren**
   Ik controleer of eerdere verrijkingsruns al een `bedrijfsnaam` of `kvk` hebben ingevuld bij leden die geen eigen factuurgegevens hebben, en rapporteer die lijst. Er wordt niets automatisch teruggedraaid zonder jouw akkoord.

## Technisch

- `supabase/functions/enrich-members-from-register/index.ts`: `memberCandidates` beperken tot `website` en `telefoon`; `bedrijfsnaam`/`kvk` als voorstel met `scope: "lid"` wegschrijven; guard `field.startsWith("factuur")` bij zowel invullen als voorstellen. Functie opnieuw deployen.
- `src/hooks/useCoffeeshopRegister.ts` (`useResolveProposal`): weigeren zodra `proposal.field` met `factuur` begint.
- `src/components/register/RegisterEnrichmentPanel.tsx`: waarschuwingsbadge bij facturatiegevoelige velden.
- Read-only query op `members_data` om te tellen hoeveel leden een register-afkomstige `bedrijfsnaam`/`kvk` hebben zonder eigen `factuurBedrijfsnaam`/`factuurKvk`.
