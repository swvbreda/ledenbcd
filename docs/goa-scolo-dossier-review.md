# GOA Leiden / Scolo — gerichte review

## Live bewijs, 5 november 2026, 19:10:25 UTC

- Canonieke ledenrij **150**: **GOA**, **Leiden**, contact **Pascal hoogewoonink**, **phoogewoonink@hotmail.com**, type `member`. Payload-ID ook 150; geen afwijkende naam/ID/contact-overlay.
- Canonieke ledenrij **32**: **Coffeeshop Scolo**, **IJmuiden**, contact **Kelvin Leenders** (bron bevat dubbele spatie), type `member`. Payload-ID ook 32; geen afwijkende overlay.
- Apart bestaand dossier **88**: Goa, Amsterdam. Dit is niet GOA Leiden; naam-only matching is onveilig.
- Aanmelding **cadbda42-08c2-4524-864a-13d32df0e0fc**, ontvangen **2026-11-05 17:04:59 UTC**: GOA / Leiden / Pascal hoogewoonink / phoogewoonink@hotmail.com, `approved`, `match_status=created`, `matched_member_id=150`.
- Het bestaande Pascal-account heeft **uitsluitend member_profiles.member_id=150**, `member_allowed_emails.member_id=150`, rol `user`. Geen koppeling met 32 aangetroffen. `user_memberships` bestaat hier niet: de bestaande accountrelatie heet `member_profiles`.
- Historische conversie **1b390e1d-8a1f-460c-b890-678297718c09**, aangemaakt **2026-10-26 16:29:36 UTC**: **lead_id=150 → lidnummer=32**.

## Concrete oorzaak en onderscheid toegang/navigatie

`MemberDetail.tsx` zocht elke keer een historische conversie op `lead_id` en navigeerde onvoorwaardelijk naar diens `lidnummer`. Daardoor opent `/leden/150` eerst GOA, maar stuurt de beheerweergave daarna naar `/leden/32` (Scolo). ID 150 is inmiddels opnieuw een actuele ledenrij. De code behandelde historie ten onrechte als de huidige identiteit.

Dit bewijst een verkeerde admin-doorverwijzing, **niet** dat Pascal toegang heeft tot Scolo. Zijn actuele databasekoppelingen wijzen alleen naar 150; de eigen-rij SELECT-regels gebruiken `member_profiles` en houden autorisatie server-side. Gewone gebruikers ontvangen geen conversiehistorie via de huidige hook. Er is geen echte Pascal-login getest en daarom geen claim over zijn volledige ingelogde ervaring.

De herkomst/juistheid van de conversie van 26 oktober is niet ondubbelzinnig bewezen: er is geen vastgelegde shopidentiteit in deze historische verwijzing. De historie is daarom niet verwijderd of gewijzigd. Voor de huidige GOA-relatie is geen datacorrectie nodig: rij, aanmelding, contactemail en accountlink stemmen overeen.

Tweede concreet risico: Goedkeuringen gebruikte de eerste overeenkomst op e-mail **of alleen shopnaam**, zonder plaats of geregistreerd match-ID. Goa Amsterdam 88 kon daardoor vóór GOA Leiden 150 worden gekozen. Dit selectiemechanisme is eveneens gericht hersteld; niet beweerd dat juist deze knop Simone's concrete incident veroorzaakte.

## Gerichte diff

- `src/lib/memberDossierIdentity.ts`: actuele canonical ID gaat voor; een historisch redirect mag alleen bij afwezige huidige rij, één unieke bestemming en een werkelijk bestaande doelrij. Aanvraagdoel gebruikt vastgelegd ID plus shop/plaatscontrole; tegenstrijdige of ontbrekende vastgelegde relaties worden geblokkeerd, nooit vervangen door eerste record.
- `src/pages/MemberDetail.tsx`: redirect gebruikt deze controle en wacht op actuele dossierlijst zonder bronfout; leadstatusmemo ververst bij gewijzigde lijst.
- `src/hooks/useMemberEdits.ts`: ontbrekend dossier wordt niet meer gefabriceerd uit een andere lead en historische conversie; laden wacht op dossierlijst; overlays kunnen canonical ID niet veranderen.
- `src/routes/_dashboard/leden.$id.tsx`: pagina krijgt ID als React-key, zodat contactselecties/editstate en open dossierstate niet uit het vorige dossier blijven staan.
- `src/hooks/useMembershipRequests.ts`: bestaande bronvelden `matched_member_id` en `match_status` getypeerd.
- `src/pages/GoedkeuringenPage.tsx`: vastgelegde match met shop/plaats controleren; conflicterende koppeling krijgt waarschuwing en geblokkeerde goedkeuring/doorklik. Geen nieuwe autorisatie.
- `src/components/__tests__/MemberDossierIdentity.render.tsx`: 11 gerichte regressies, waaronder 150/32/150 met dezelfde querycache, verkeerde overlay-ID, Goa Amsterdam, ontbrekende en ambigue bestemming, en wachten op dossierdata.

## Verificatie

- **11** nieuwe dossier-/hookregressies geslaagd.
- **6** contactverwijderingsregressies, **2** woordvoerderrendertests, **4** beleidsrendertests, **10** echte bronadapter-/foutclassificatietests opnieuw geslaagd: **33 tests totaal**.
- Automatische buildcontrole **OK** na reparatie van een expliciete-return typecheckmelding.
- Optionele lokale canvas-installatie ontbrak; defecte optionele dependency buiten het project tijdelijk verwijderd uit node_modules zodat jsdom zonder canvas werkt. Geen dependencymanifest aangepast.
- Eigen sessie via `auth-session --self` niet beschikbaar: geen account match voor de requesting identity. Geen fictieve sessie of derde-account gebruikt. Volledige ingelogde admin/Pascal-keten blijft onbewezen.

## Afzonderlijke eerdere werkzaamheden

- **Beleid:** eerdere beperkte laad-/foutafhandelingsfix behouden; 14 tests opnieuw geslaagd. Eerdere echte bronreadback: 342 gemeenten en echte documenten; Simone's ingelogde keten blijft afhankelijk van beschikbare sessie.
- **Woordvoerders:** eerdere adapter/weergave behouden, twee rendertests opnieuw geslaagd. Eerder vier echte afdelingen teruggelezen; volledig ingelogde dashboardketen blijft ongecontroleerd.

Geen publicatie/deploy, geen gewijzigde leden-/account-/rolrelatie, geen records samengevoegd/verwijderd, geen factuur/boeking, geen mails/reset/push/Planner/Topical-schrijfacties. Alle wijzigingen blijven preview-only.