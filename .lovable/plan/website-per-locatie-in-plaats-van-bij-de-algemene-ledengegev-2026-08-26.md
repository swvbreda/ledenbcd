# Website per locatie in plaats van bij de algemene ledengegevens

## Wat er misgaat

Bij The Bulldog staat in het blok algemene gegevens de URL
`thebulldog.com/nl/locaties/coffeeshops/the-bulldog-port/?srsltid=...`.
Dat is de pagina van één vestiging (Port), niet de website van het lid.

Oorzaak: de registerverrijking vult het lidveld `website` automatisch met de
website van de eerst gematchte registershop. Bij leden met meerdere vestigingen
levert dat een vestigingsspecifieke link op. Nu staan 16 leden met een website
geregistreerd; daarvan zijn er zeker drie vestigingsspecifiek (The Bulldog,
Greenhouse, The Plug) en twee zijn nieuwsartikelen (Boere Jongens, Hunters) in
plaats van een eigen site.

## Wat ik ga doen

1. **Website per vestiging**
   - Locatie krijgt een eigen `website`-veld, zichtbaar in de locatiekaart
     (klikbare link, met de rest van de KvK/UBO/Register-regels uitgelijnd)
     en invulbaar in het bewerkformulier.

2. **Verrijking corrigeren**
   - De registerwebsite wordt voortaan op de gematchte vestiging gezet, niet
     op het lid.
   - Het lidniveau-veld `website` wordt alleen nog automatisch gevuld als het
     lid precies één vestiging heeft; anders komt het als voorstel bij
     Goedkeuringen te staan.
   - Tracking-parameters (`?srsltid=...`) worden bij het opslaan verwijderd.

3. **Bestaande data opschonen**
   - Vestigingsspecifieke URL's bij leden met meerdere vestigingen worden
     verplaatst naar de juiste vestiging en verdwijnen uit de algemene
     gegevens.
   - Nieuwsartikel-links (Boere Jongens, Hunters) worden uit het
     website-veld gehaald; die horen niet bij "algemene gegevens".
   - Tracking-parameters worden uit de overgebleven URL's gestript.

## Technisch

- `src/data/types.ts`: `website?: string` toevoegen aan `Location`.
- `src/pages/MemberDetail.tsx`: website tonen in de locatiekaart; lidniveau
  alleen tonen als het veld gevuld is.
- `src/components/register/LocationRegisterInfo.tsx`: registerwebsite als regel
  opnemen wanneer die afwijkt van de opgeslagen locatiewebsite.
- `src/components/MemberEditForm.tsx`: invoerveld per locatie.
- `supabase/functions/enrich-members-from-register/index.ts`: `website` uit
  `memberCandidates` halen, toevoegen aan de locatievelden, en bij
  multi-locatieleden als voorstel wegschrijven; URL-normalisatie-helper.
- Data-opschoning via een eenmalige SQL-update op `members_data`.
