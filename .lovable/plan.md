# Registergegevens (incl. logo's) doorzetten naar de ledenprofielen

Het register in Coffeeshopbeleid bevat per vestiging veel meer velden dan we nu overnemen. In de opgeslagen brondata staan onder andere `logo_url` (66 shops), `socials` (64), `oprichtingsdatum` (290), `website` (68), `telefoon` (45), plus shopcode, BAG-ids, coördinaten, vergunningdata en verrijkingsherkomst. Alleen een deel daarvan komt nu in eigen kolommen terecht; de rest zit alleen in het `raw`-veld en wordt nergens getoond of aan leden gekoppeld.

## Wat er komt

1. **Meer registervelden echt opslaan**
   Logo, socials (Instagram/Facebook/website-varianten), oprichtingsdatum + bron, shopcode, BAG-/pandgegevens en verrijkingsdatum krijgen eigen kolommen in het register, zodat ze doorzoekbaar en toonbaar zijn.

2. **Logo's overnemen bij de leden**
   - Per gekoppelde vestiging wordt het registerlogo opgeslagen bij die locatie van het lid.
   - Heeft het lid nog geen eigen logo, dan wordt het registerlogo automatisch als ledenlogo gezet (gedownload naar de bestaande logo-opslag, zodat het blijft werken als de bron verdwijnt).
   - Een handmatig geüpload logo wordt nooit overschreven; het registerlogo verschijnt dan als voorstel ("Overnemen / Negeren") in de bestaande aanvullingenlijst.

3. **Overige extra gegevens naar het ledenprofiel**
   Lege velden worden aangevuld (nooit overschrijven): oprichtingsdatum, website, telefoon, Instagram/Facebook uit socials, en de vergunningsgegevens per vestiging. Afwijkingen worden voorstellen, net als nu.

4. **Zichtbaar in de app**
   - Ledendetail: logo van de vestiging naast de locatie, en de extra registervelden in het bestaande blok "Gelieerde coffeeshops (register)".
   - Ledenlijst/kaarten: logo uit het register als er geen eigen logo is.
   - Registerpagina en detailvenster: logo, socials en de nieuwe velden zichtbaar.

## Technisch

- Migratie: kolommen `logo_url`, `logo_pad`, `socials jsonb`, `oprichtingsdatum`, `oprichtingsdatum_bron`, `shopcode`, `bag_pand_id`, `bag_verblijfsobject_id`, `verrijkt_op` op `coffeeshop_register`; geen RLS-wijziging nodig.
- `sync-coffeeshopregister`: mapping uitbreiden met deze velden (uit de beveiligde export en uit `raw` als terugval). Logo's worden bij de sync eenmalig naar een nieuwe publieke bucket `register-logos` gekopieerd (pad `<bron_id>.<ext>`) en het pad opgeslagen; opnieuw ophalen alleen als de bron-URL wijzigt.
- `enrich-members-from-register`: nieuwe velden meenemen in de bestaande fetch-and-merge (locatievelden `logo`, `website`, `instagram`, `facebook`, `oprichtingsDatum`, `vergunninghouder`, `exploitant`). Bij een gevuld en afwijkend veld → rij in `register_enrichment_proposals` met bron `register`. Bij het toepassen van een logo-voorstel wordt het bestand naar `member-logos/<lid>/logo.<ext>` geschreven.
- Types: `Location` in `src/data/types.ts` uitbreiden met `logo`, `instagram`, `facebook`, `socials`.
- Frontend: `LocationRegisterInfo.tsx`, `CoffeeshopRegisterDetailDialog.tsx`, `RegisterEnrichmentPanel.tsx` en `MemberDetail.tsx` tonen de nieuwe velden; `useMemberLogo` valt terug op het registerlogo als er geen eigen logo is.
- Na de wijziging draait een volledige registersync + verrijkingsrun zodat de bestaande 604 registerrijen worden bijgewerkt.

## Uitgangspunten

- Handmatig ingevoerde ledengegevens en factuurvelden blijven onaangeroerd.
- Bevestigde koppelingen blijven staan; alleen brongegevens worden verrijkt.
