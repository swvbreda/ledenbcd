# De Loods en De Rode Leeuw samenvoegen tot één lid

## Wat er misgaat

In het ledenbestand staan twee aparte leden:

- lid 37 — De Rode Leeuw, Zwolle, maar met het adres **Textielweg 11** (het adres van Amersfoort)
- lid 38 — De Loods, Textielweg 11, Amersfoort

Omdat beide hetzelfde adres hebben, zijn ze in het register kriskras aan elkaar gekoppeld: De Loods is bevestigd gekoppeld aan de Zwolse registershop en De Rode Leeuw aan de Amersfoortse. Daardoor stelt het register nu voor dat De Loods "verhuist" naar Rodeleeuwstraat 4 in Zwolle. Dat is geen verhuizing, maar een verkeerde koppeling.

## Wat er gaat gebeuren

1. **Samenvoegen** — De Rode Leeuw (lid 37) blijft het lid. De Loods wordt daar de tweede vestiging, met het eigen adres Textielweg 11, 3812 RV Amersfoort. De vestiging De Rode Leeuw krijgt het juiste adres Rodeleeuwstraat 4, 8011 TC Zwolle. Contactpersoon en e-mailadres van De Loods gaan mee als extra contactpersoon.
2. **Contributie** — beide contributies en facturen blijven bestaan en komen onder het samengevoegde lid te staan; het lid betaalt dus voor twee vestigingen.
3. **Het oude record van De Loods** wordt gearchiveerd, niet zomaar weggegooid, zodat er niets verloren gaat.
4. **Registerkoppelingen opschonen** — de vier bestaande koppelingen worden vervangen door twee juiste: Amersfoort → vestiging De Loods, Zwolle → vestiging De Rode Leeuw. Het onterechte verhuizingsvoorstel verdwijnt.
5. **Herhaling voorkomen** — het koppelen gaat voortaan nooit meer over een andere plaats of postcode heen, en één registershop kan maar aan één lid bevestigd gekoppeld zijn. Als naam en adres elkaar tegenspreken, wordt het een voorstel om te bekijken in plaats van een automatische match.
6. Na het opschonen wordt de opgave van het lid (KvK, vergunninghouder, exploitant) opnieuw naar de juiste registershops geschreven.

## Technisch

- Datamigratie in `members_data`: locaties van lid 38 toevoegen aan lid 37 (met gecorrigeerde adressen), contacten samenvoegen, lid 38 op `member_type = 'old'` met verwijzing naar 37; `member_contributions`, `contribution_invoices`, `informer_debtor_map` en overige lidverwijzingen van 38 naar 37 verzetten.
- `coffeeshop_member_links`: de vier rijen voor 37/38 verwijderen en twee bevestigde links opnieuw aanmaken met de juiste `location_key`s; openstaande `register_enrichment_proposals` voor deze twee shops verwijderen.
- `sync-coffeeshopregister` / de matcher: koppelingen met afwijkende plaats én postcode niet meer automatisch bevestigen, en een shop met een bestaande bevestigde koppeling aan een ander lid overslaan.
- Daarna `apply_member_register_opgave(37)` draaien.
