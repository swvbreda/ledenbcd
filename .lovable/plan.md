# Foto's bij contactpersonen en logo's bij leden

Twee toevoegingen: een profielfoto per contactpersoon/account, en een logo per lid dat op de ledenpagina's zichtbaar is.

## Foto's bij contactpersonen

- Elke contactpersoon in het blok "Contactpersonen" op de ledenpagina krijgt een ronde avatar (initialen als er geen foto is).
- Bestuur/admin kan een foto uploaden of vervangen via een camera-knopje op de avatar, net zoals dat nu al werkt bij het bestuursoverzicht.
- Een lid dat zelf inlogt kan de foto bij zijn eigen contactpersoon aanpassen via Mijn Account.
- Foto's worden ook getoond in het accountbeheer-overzicht, zodat je bij een account meteen ziet wie het is.
- Verwijderen van een foto is mogelijk; de avatar valt dan terug op initialen.

## Logo's bij leden

- Bovenaan de ledenpagina komt naast de naam een logo (of een neutrale placeholder met initialen als er nog geen logo is).
- Upload/vervangen/verwijderen via hetzelfde knopje-patroon, voor bestuur/admin en het lid zelf.
- Het logo verschijnt daarna ook in de ledenlijst en in de locatiekaarten, zodat je leden sneller herkent.

## Technische uitwerking

- Twee nieuwe storage buckets: `contact-photos` en `member-logos` (publiek leesbaar, upload alleen voor ingelogde bestuurs-/adminaccounts en het lid zelf, via RLS-policies op `storage.objects`).
- Bestandspad-conventie: `member-logos/<member_id>.<ext>` en `contact-photos/<member_id>/<contact-slug>.<ext>`, met `upsert` zodat vervangen geen weesbestanden achterlaat.
- Nieuwe hook `src/hooks/useMemberMedia.ts` voor uploaden, ophalen van public URL's (met cache-busting timestamp) en verwijderen.
- Herbruikbaar component `src/components/members/AvatarUpload.tsx` (ronde avatar of vierkant logo, initialen-fallback, camera-overlay bij bewerkrechten).
- Aanpassingen in `MemberDetail.tsx` (koptekst + contactpersonenblok), `MemberTable.tsx`, `AccountBeheerPage.tsx` en `MijnAccountPage.tsx`.
- Bestandsvalidatie: alleen afbeeldingen, max ~5 MB; foutmeldingen via de bestaande toasts.
- Geen wijziging aan `members_data`/`member_edits`: de koppeling loopt via het vaste bestandspad, dus ledengegevens kunnen niet worden overschreven.
