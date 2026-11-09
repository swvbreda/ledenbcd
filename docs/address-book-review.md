# Contacten — review 9 november 2026

## Resultaat
- `/contacten`: organisatieoverzicht, alfabetische sortering, categorie, algemene gegevens en aantal contacten. Eén zoekveld zoekt organisaties/afkortingen en namen/functies/afdelingen/fracties/e-mail; aparte persoonsresultaten tonen direct de juiste persoon en organisatie.
- `/contacten/<uuid>`: algemene organisatiegegevens en meerdere personen; toevoegen, bewerken, verwijderen met bevestiging. Organisatieverwijdering noemt het aantal onderliggende contacten.
- Bestaande AppSidebar verzorgt hetzelfde Contacten-menu op desktop en mobiel; zichtbaar alleen voor ingelogde admin/bestuursrechten, niet voor externen. Pagina toetst opgeloste toegangsstatus vóór ophalen; bestaande ProtectedRoute behoudt login/toegang.
- BcdHeroBanner, Barlow/Archivo Black, bestaande knoppen, rood omrande persoonskaarten, formulieren en feedback behouden.
- E-mail mailto/kopiëren, telefoon tel, veilige http/https-website. Geen accounts, uitnodigingen, verrijking of verzendcode.

## Bestanden
- `src/routes/_dashboard/contacten.index.tsx`, `contacten.$id.tsx`: routes, zoekparameters en eigen private socialHead-metadata.
- `src/components/contacten/{AddressBookPage,AddressForm,AddressErrorBoundary,ContactLinks}.tsx`.
- `src/lib/addressBook.ts`, `addressBookClient.ts`: modellen/zoekregels, gepagineerde user-scoped reads, rij-gecontroleerde mutations. Alleen deze twee nieuwe tabellen worden benaderd.
- `src/components/AppSidebar.tsx`, `AGENTS.md`, `roadmap.md`.
- `drizzle/migrations/0076_internal_address_book.sql`, `0077_address_book_minimal_grants.sql`: beide daadwerkelijk toegepast. Gegenereerde database-typen bijgewerkt door migratietool.
- `src/components/__tests__/AddressBook.render.tsx`, `supabase/tests/address_book_rls.sql`, `address_book_fixture_extract.py`.

## Database
- Eigen `address_book_organizations` en `address_book_contacts`; geen gebruik/wijziging van external_organizations/external_org_contacts of ledencontacten.
- SELECT/INSERT/UPDATE/DELETE onder één ALL-policy met USING én WITH CHECK: bestaande `has_role(auth.uid(),'admin') OR is_board_member(auth.uid())`.
- Actuele helperdefinities gecontroleerd: admin uit user_roles; bestuur via board_members.lid_id/lid_ids gekoppeld aan member_profiles. Geen metadata/clientopslag als database-autorisatie.
- Eerste live readback liet geërfde anon/brede grants zien; migratie 0077 trekt die voor alleen het nieuwe adresboek in. Live readback: anon geen grants, authenticated uitsluitend CRUD, service_role volledig. RLS op beide tabellen aan, geen custom communicatie-triggers.
- Enige cascade: organisatie → contacten uit dit adresboek.

## Gecontroleerd
- Geïsoleerde echte PostgreSQL, actuele helperdefinities read-only geëxporteerd, synthetische role/profile/board-inputs, echte authenticated/anon rollen en de migraties exact toegepast. Geen helpermock/autoriseer-bypass.
- Admin en board: organisaties/personen lezen, toevoegen, bewerken, verwijderen. Organisatie met twee personen en gewijzigde functie teruggelezen; cascade gecontroleerd.
- Gewoon lid, extern en ongelinkte inhuur: SELECT leeg; INSERT geweigerd; UPDATE/DELETE nul rijen voor beide tabellen. Anoniem: geen toegang tot beide tabellen.
- Alle testgegevens transactioneel teruggedraaid: geïsoleerd 0 organisaties/0 personen. Productie eveneens 0/0; daar geen testgegevens toegevoegd.
- Gerichte componenttests: zoeken op naam/functie/afdeling/e-mail, categorieën/default, gecontroleerde rechten, safe links, nul-rij mutationfouten, opgeslagen ID, formulierfouten, geslaagde naam-only persoon, kopieersucces/-fout en beschermde IDs bij bewerken. Bestaande BestuurOverzicht-regressies ook geslaagd.
- Playwright echte `/contacten` signed-out → `/login`, zonder runtimefouten. Het daadwerkelijke AddressForm-module los gerenderd voor presentatiecontrole (geen fictieve sessie): desktop en 390×844, scrollbare dialog volledig binnen viewport en Opslaan bereikbaar. Dit is geen ingelogde adresboekketen.
- Automatische typecheck/build: build OK.

## Beperking
Geen eigen ingelogde sessie beschikbaar (`signed_out`); geen authmint of account van een ander gebruikt. Daardoor volledige browserketen organisatie + twee personen → herladen → zoeken/kopiëren en ingelogd desktop/mobielmenu nog niet end-to-end geverifieerd. CRUD/readback en echte RLS afzonderlijk geïsoleerd getest; presentatie afzonderlijk getest, niet als echte login gepresenteerd.

Geen publicatie, berichten, wijzigingen aan bestaande leden/rollen/lidmaatschap/Externe partijen of financiële gegevens.