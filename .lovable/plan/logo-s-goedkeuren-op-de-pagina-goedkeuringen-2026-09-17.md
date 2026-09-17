# Logo's goedkeuren op de pagina Goedkeuringen

Er staan nu 42 logo's van aangesloten coffeeshops klaar die nog niet zijn goedgekeurd. Zolang ze niet zijn goedgekeurd, blijft de logowand op coffeeshopbond.nl leeg.

## Wat er komt

Bovenaan de pagina **Goedkeuringen** komt een blok "Logo's van coffeeshops" met een teller van het aantal wachtende logo's.

- Een raster met alle nog niet goedgekeurde logo's van aangesloten coffeeshops, groot genoeg om te beoordelen, met naam en plaats eronder.
- Per logo twee knoppen: **Goedkeuren** en **Afkeuren**. Afkeuren wist het logo, zodat de automatische zoeker het niet opnieuw als goed aanmerkt.
- Per logo de mogelijkheid om zelf een aangeleverd logobestand te uploaden ter vervanging; dat telt meteen als goedgekeurd.
- Een knop **Alles goedkeuren** voor de logo's die op dat moment in beeld staan, met een bevestigingsvraag.
- Een schakelaar om ook de al goedgekeurde logo's te bekijken, zodat je een eerdere keuze kunt terugdraaien.
- Hulptekst: "Goedgekeurde logo's staan binnen vijf minuten op coffeeshopbond.nl."
- Is alles beoordeeld, dan staat er simpelweg dat er geen logo's wachten.

De bestaande beoordeling per shop (in het registervenster en bij een vestiging op de ledenpagina) blijft gewoon werken.

## Technisch

- Nieuwe serverfunctie `listShopLogosForReview` in `src/lib/shopLogo.functions.ts` (createServerFn + `requireSupabaseAuth` + bestaande `assertBeheer`): geeft per bevestigd gekoppelde, niet-vervallen shop met een logo `{ register_id, naam, plaats, lid_id, lid_naam, logo_gecontroleerd }` terug, gefilterd op goedgekeurd/niet-goedgekeurd, gesorteerd op naam. Leest via `supabaseAdmin` binnen de handler, na de rechtencontrole.
- Bestaande `setShopLogoApproval` en `uploadShopLogo` worden hergebruikt; "Alles goedkeuren" roept `setShopLogoApproval` per shop aan (gebundeld met beperkte gelijktijdigheid).
- Nieuw component `src/components/register/LogoGoedkeuringPanel.tsx`: raster van kaarten met preview via `/api/public/shop-logo/<id>?v=<cachebust>`, knoppen, upload-input en toasts; gebruikt `useServerFn` + React Query, invalidateert `["shop-logo-review"]`, `["shop-logo-status"]` en `["member-register-logos"]`.
- `src/pages/GoedkeuringenPage.tsx`: panel renderen boven `RegisterLinkApprovals`, binnen de bestaande `isAdmin`-check.
- Geen databasewijzigingen nodig; kolommen `logo_gecontroleerd`, `logo_gecontroleerd_op` en `logo_gecontroleerd_door` bestaan al en het publieke endpoint filtert al op goedgekeurd.
