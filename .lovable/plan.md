# Gekoppelde deelnemer ook opslaan bij het lid

Nu wordt bij het koppelen van een WhatsApp-deelnemer alleen de deelnemer bijgewerkt (`member_id`). De naam en het telefoonnummer verdwijnen daarmee niet in het ledenprofiel — daar staat niets. Dat gaan we veranderen.

## Wat er verandert

Zodra je een deelnemer (naam + telefoonnummer) aan een lid koppelt, verschijnt een klein venster met de keuze wat er bij het lid wordt opgeslagen:

1. **Toevoegen als contactpersoon** (standaard) — naam en telefoon komen in de contactenlijst van het lid, met functie "Community" (aanpasbaar in het venster).
2. **Hoofdtelefoonnummer bijwerken** — alleen zichtbaar als het lid nog geen of een ander hoofdnummer heeft; werkt `telefoon` (en zo nodig `contactpersoon`) bij.
3. **Niets opslaan** — alleen de koppeling, zoals nu.

Het venster toont de naam, het net-geformatteerde telefoonnummer en de naam van het lid, en welke gegevens het lid nu al heeft, zodat je ziet wat je overschrijft. Als naam en nummer al bij het lid staan, meldt het venster dat en slaat het niets dubbel op.

De wijziging wordt direct opgeslagen (geen goedkeuringsronde), zoals gevraagd. Bestaande ledengegevens worden nooit overschreven zonder dat je dat expliciet kiest.

Dit werkt op alle plekken waar je koppelt:
- de todo-lijst met deelnemers (los koppelen en bevestigen van een voorstel),
- de zelf-aanmeldingen via `/koppelen` (daar staat vaak ook e-mail en shopnaam, die worden meegenomen in het contactvoorstel).

Bij "Alles automatisch koppelen" (telefoonmatches) verschijnt het venster niet — daar is het nummer al bekend bij het lid, dus er valt niets toe te voegen.

## Technisch

- Nieuwe helper `src/lib/memberContactUpsert.ts`: bepaalt of naam/telefoon al bij het lid bekend zijn (via `telefoon`, `telefoon2`, `factuurTelefoon`, `contacten[].telefoon`, genormaliseerd met `normalizePhone`) en bouwt de patch: nieuwe `contacten`-entry of bijgewerkt `telefoon`/`contactpersoon`. Unit-tests voor beide varianten en de "al bekend"-situatie.
- Nieuw dialoogcomponent `src/components/community/SaveContactToMemberDialog.tsx` met de drie keuzes, bewerkbare naam/functie/telefoon/e-mail en een korte zod-validatie (naam max 100, telefoon-formaat, e-mail optioneel).
- Opslaan gebeurt via de bestaande fetch-en-merge route naar `member_edits` (zelfde patroon als `useMemberEdits` gebruikt): huidige `data` ophalen, samenvoegen, terugschrijven — nooit blind overschrijven. Daarna `refetchMembers()` en invalidatie van `member-edits`.
- `src/components/CommunityTodoList.tsx`: `linkToMember` en het bevestigen van een voorstel openen eerst de dialoog; de koppeling zelf wordt na de keuze (of "Niets opslaan") uitgevoerd.
- `src/components/CommunitySelfLinkList.tsx`: `link()` krijgt dezelfde dialoogstap, voorgevuld met `full_name`, `phone`, `email`.
- Geen databasewijzigingen.
