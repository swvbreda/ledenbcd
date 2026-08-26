# Hunters-voorstel corrigeren naar vestigingsniveau

## Wat er speelt

Het openstaande voorstel voor Hunters is nog als algemene wijziging opgeslagen: `Hunters → Sensi Smile B.V.` op het veld **Bedrijfsnaam**. De gekoppelde registerrij is echter alleen de vestiging **Hunters Rotterdam, Henegouwerlaan 73A**.

De actuele verrijkingscode verwerkt vergunninghouder en exploitant al op locatieniveau. Bij Hunters staat **Sensi Smile B.V.** bovendien al als vergunninghouder op de Rotterdamse locatie. Het scherm toont dus een oud voorstel van vóór die correctie.

## Aanpak

1. Het verouderde algemene voorstel voor Hunters negeren/afsluiten, zodat het niet meer onder “Algemene ledengegevens” verschijnt en de bedrijfs- of facturatienaam niet kan worden gewijzigd.
2. Controleren dat Sensi Smile B.V. uitsluitend bij de locatie Hunters Rotterdam blijft staan.
3. Bestaande open voorstellen opschonen die eveneens een bedrijfsnaam op lidniveau willen wijzigen bij leden met meerdere vestigingen.
4. De verrijkingsfunctie defensief aanscherpen zodat zulke oude of ongeldige algemene bedrijfsnaamvoorstellen bij een volgende run automatisch worden afgesloten en niet opnieuw zichtbaar worden.

## Technisch

- Datawijzigingen gebeuren gericht in `register_enrichment_proposals`; de ledengegevens van Hunters worden niet overschreven.
- De bestaande vestigingsvelden `vergunninghouder` en `exploitant` blijven leidend voor registerinformatie per locatie.
- Na de wijziging wordt gecontroleerd dat er voor Hunters geen open algemeen voorstel voor `bedrijfsnaam` meer bestaat.
