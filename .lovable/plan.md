# Bestuur → Vergaderingen en notulen

## Uitvoering
- Bouw direct in het bestaande portaal op `/bestuur/notulen` en `/bestuur/notulen/<id>`; geen publicatie.
- Bestuur en beheerders lezen; alleen beheerders voegen toe, maken nieuwe versies, uploaden bijlagen en stellen expliciet vast. Bestaande rechtenbron blijft intact.
- Overzicht met datum, titel, concept/vastgesteld, bron, inhoud-/onderwerpzoekfunctie en jaarfilter. Detail toont verslag, besluiten, acties, originele bestanden en versiegeschiedenis.
- Upload/import bewaart het originele bestand en de naam, bron-id en bronverwijzing. Alleen expliciet bevestigde bestuursnotulen, geen automatische indeling van ALV of externe overleggen.
- Topical biedt hier alleen een taken-/agendakoppeling, geen aangetroffen verslagtoegang; geen verslagen verzinnen of taken als notulen importeren. OneDrive-bestanden en nieuw concept volgen via beveiligde upload, zonder nieuwe credentials.

## Techniek
- Afzonderlijke tabellen en private bucket, bestaande `has_role`/`is_board_member`, admin-only gecontroleerde RPC-mutaties, append-only versies/bijlagen en vaststelling met serveractor/tijd.
- Download via geauthenticeerde opslagfetch naar Blob, geen publieke of overdraagbare signed URL. Deduplicatie op bron-id en inhouds-/bestandhash; gewijzigde inhoud levert een nieuwe versie.
- Geïsoleerde PostgreSQL-rechten/versietests en echte componenttests; desktop/mobiel en downloadcontrole waar mogelijk. Geen productie-testrecords, accountwijzigingen, externe writes of wijzigingen aan andere lopende functies.