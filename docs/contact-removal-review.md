# Contactpersoon verwijderen — gerichte oplevering

## Gedrag
- Vooraf waarschuwing: verwijderen bij opslaan/goedkeuren verwijdert ook gekoppelde login en toegang.
- Admincheck via actuele `user_roles` onder de rechten van de aanvrager; de database controleert opnieuw.
- Geen naam-gebaseerde accountkeuze: genormaliseerd contactadres moet precies één Auth UUID én een bevestigde `member_profiles`-koppeling opleveren. Geen adres met bestaande profielen, meerdere passende accounts, onbevestigde koppeling, andere leden/organisaties, eigen account en beheerders/bestuursaccounts blokkeren.
- Eerst duurzame registratie + UUID-toegangsintrekking; daarna Auth ban en `deleteUser(id, true)`; pas daarna contactwijziging afronden. Soft-delete bewaart historische actor-FK's, o.a. declaraties en contributiebetalingen. Geen bedrijfs-, financiële of ledenrecords verwijderen.
- Bij een gedeeltelijke fout blijft de contactpersoon staan en toegang geblokkeerd; geen succesmelding. Opnieuw dezelfde wijziging uitvoeren hervat dezelfde registratie. Andere wijzigingen bij dat lid zijn intussen geblokkeerd.
- Oude JWT's worden niet cryptografisch ingetrokken: `contact_access_check` weigert ze vóór alle REST/RPC-aanvragen, ook SECURITY DEFINER RPC's; restrictive Storage-policy beschermt privéobjecten. Ban/soft-delete blokkeert nieuwe login/refresh; bestaande ondertekende URL's en reeds lokaal gedownloade gegevens kunnen niet worden teruggehaald.
- Oude basis-/factuuradressen blijven als historie staan maar worden via `removed_contact_emails` niet opnieuw als toegestane toegang toegevoegd.

## Onderzochte routes
- `MemberEditForm.tsx`: lokaal verwijderen + direct opslaan of indienen.
- `useMemberEdits.ts`: direct opslaan en goedkeuren van ledenwijzigingen.
- `MijnAccountPage.tsx`: los direct profielopslaan.
- DB-guards op `member_edits` en `members_data` onderscheppen alternatieve/directe writers. Niet-admin verzoeken blijven voorstellen totdat een beheerder de beveiligde route goedkeurt.
- Externe-organisatiecontacten, accountbeheer, hele-lidverwijdering, leadconversie en signup-rollback zijn andere lifecycleacties; niet gewijzigd.

## Bestanden
- `src/lib/contactRemoval.ts`, `src/lib/contactRemoval.functions.ts`, `src/lib/contactRemoval.test.ts`
- `src/components/MemberEditForm.tsx`, `src/hooks/useMemberEdits.ts`, `src/pages/MijnAccountPage.tsx`
- `drizzle/migrations/0069_contact_removal_access_guard.sql`
- `supabase/tests/contact_removal.sql`, `contact_removal_fixture.sql`, `contact_removal_run.sh`
- `AGENTS.md`, `roadmap.md`

## Bewijs
- 25 tests in vijf gerichte testbestanden geslaagd.
- Volledig aparte PostgreSQL-proef met dezelfde migratie: `CONTACT_REMOVAL_ASSERTS_OK` en `CONTACT_REMOVAL_SECURITY_OK`; onbevoegd, gedeeld, beschermd, ontbrekende koppeling/account, directe bypass, oude JWT, gedeeltelijke fout, retry, geen RPC-rechten voor anon/member en historiebehoud.
- Automatische compiler/typecontrole: laatste uitkomst build OK, 24 oktober 2026 21:03 UTC.
- Live readback: migratie 0069 aanwezig; 3 nieuwe tabellen; PostgREST pre-request ingesteld; Storage-policy aanwezig; 0 operaties, 0 intrekkingen, 0 verwijderde adressen.
- Inventaris: 0 accounts gekoppeld aan meerdere leden via member_profiles; 0 andere leden via bestaande toegestane adressen; 15 accounts met beschermde niet-userrollen; 14 accounts zonder ledenprofiel (waaronder ook andere accounttypen). Geen personen verwijderd of opgeruimd.
- Frontend/serverfunctie niet gepubliceerd. Alleen databasebeveiliging toegepast; bestaande live frontend kan daarom contactverwijdering weigeren totdat de nieuwe bouwversie wordt gepubliceerd. Geen automatische verwerking geactiveerd.
- Geen echte destructieve Auth/device-ketentest: uitdrukkelijk uitgesloten door de opdracht. Sessies/soft-delete conform documentatie en geïsoleerde simulatie, niet bewezen met een echt verwijderd productieaccount.

## Actuele documentatie
## Gerichte review 24 oktober 2026
- Migratie `0070_contact_removal_multiset_identity.sql`: één-op-één vergelijken met multipliciteit; niet-unieke naam is geen identificatie. Exacte naam+email eerst, daarna uniek email bij naamwijziging, uniek naam bij emailwijziging. Gedeeld loginadres met overblijvende persoon blokkeert, ook identieke dubbele contacten.
- `MijnAccountPage.tsx`: de verwijderaanroep staat uitsluitend binnen `if (isAdmin)`; `else` dient gewone profielwijzigingen in zonder die aanroep. Bewezen door de echte ProfileCard-test met niet-admin.
- `useMemberEdits.ts`: uitnodigingen na geslaagde verwijdering werken weer bij direct opslaan én goedkeuren, alleen voor nieuwe adressen; nooit bij mislukte verwijdering.
- `ContactRemovalFlows.render.tsx`: echte MemberEditForm-verwijderknop → hook → servermock bevat uitsluitend de overgebleven array; vervangende/lege arrays worden niet terug samengevoegd. Tests voeren geen echte mail- of verwijderaanroep uit.
- 6 scherm/gedragstests + 21 bestaande gerichte regressies geslaagd. SQL-proef: oorspronkelijke beveiligingsasserties + `CONTACT_MULTISET_ASSERTS_OK` (zelfde namen, gedeelde email, multipliciteit, herschikken, wijzigen, tegelijk toevoegen/verwijderen).
- Automatische typecontrole/compilatie: build OK 21:07 UTC. Geen publicatie of echte deletes.

## Documentatielinks
- https://supabase.com/docs/reference/javascript/auth-admin-deleteuser — soft-delete optie.
- https://supabase.com/docs/guides/auth/signout — refresh intrekken maakt bestaande JWT niet ongeldig vóór exp.
- https://supabase.com/docs/reference/javascript/auth-signout
- https://supabase.com/docs/guides/auth/managing-user-data — Auth-user-FK/historie gevolgen.
