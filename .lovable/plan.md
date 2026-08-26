# Plan: duidelijk maken bij welke locatie een algemeen voorstel hoort

## Probleem
Onder "Algemene ledengegevens" staan KvK-voorstellen (bijv. lid 30: 33196210 → 34267690 / 33227151 / 33137040) zonder dat zichtbaar is bij welke vestiging ze horen. Dit zijn verouderde voorstellen op lid-niveau; KvK-nummers horen per vestiging (locatie) te zitten.

## Aanpassingen

1. **Data-opruiming (SQL)**
   - Alle openstaande voorstellen met `scope = 'lid'` en `field = 'kvk'` op status `genegeerd` zetten — KvK wordt voortaan uitsluitend per locatie voorgesteld.
   - Zelfde opschoning voor `bedrijfsnaam`-voorstellen op lid-niveau bij leden met meer dan één vestiging.

2. **Edge Function `enrich-members-from-register` aanscherpen**
   - De bestaande "stale cleanup" (die oude bedrijfsnaamvoorstellen bij meerlocatieleden negeert) uitbreiden naar `kvk` en overige lid-scope velden, zodat deze nooit meer terugkomen.
   - Functie opnieuw deployen.

3. **UI: herkomst tonen bij algemene voorstellen** (`RegisterEnrichmentPanel.tsx`)
   - Bij groepen onder "Algemene ledengegevens" de registerregel tonen die nu alleen bij locatiegroepen staat: `Register: [naam] — [adres]`, zodat elk resterend algemeen voorstel zichtbaar maakt uit welke vestiging/registerwinkel het komt.
   - Subtitel "Geldt voor het hele lid" verduidelijken waar het voorstel eigenlijk van één vestiging afkomstig is.

## Technische details
- Geen schema-wijzigingen; alleen status-updates in `register_enrichment_proposals`, een wijziging in `supabase/functions/enrich-members-from-register/index.ts` en een UI-aanpassing in `src/components/register/RegisterEnrichmentPanel.tsx`.
- Na deploy een handmatige verrijkingsrun triggeren om te verifiëren dat de drie KvK-voorstellen van lid 30 niet terugkeren.
