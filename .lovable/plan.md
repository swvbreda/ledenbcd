# Eigenaarschap per vestiging + accountkoppeling herstellen

Twee dingen: (1) per contactpersoon vastleggen en tonen van welke vestigingen hij/zij eigenaar is, (2) accounts die al bestaan maar niet aan een lid gekoppeld zijn automatisch koppelen.

## 1. Wie is waar eigenaar van

Nu staat bij lid 66 (The Plug / Utopia) zowel Jimmy Lin als Michael van Nieuwkasteele als "Eigenaar", zonder dat zichtbaar is dat Michael alleen bij Smokery (Marktstraat 33, Wormerveer) hoort.

**Vastleggen**
- Contactpersonen krijgen een extra veld met de vestigingen waar ze bij horen (leeg = geldt voor het hele lid).
- In het bewerkscherm van een lid komt per contactpersoon een keuzelijst met alle vestigingen van dat lid ("Geldt voor: alle vestigingen / specifieke vestigingen aanvinken").
- Vestigingen worden herkend via hun bestaande identiteit (postcode/adres), zodat de koppeling blijft kloppen als een adres licht wijzigt.

**Tonen**
- Op de ledenpagina bij elke contactpersoon: een regel "Eigenaar van: Smokery (Wormerveer)" of "Alle vestigingen".
- Op elke locatiekaart: een regel "Eigenaar/contact: Michael van Nieuwkasteele", zodat je vanaf de vestiging ziet wie erbij hoort.
- In het blok "Vergunninghouders & eigenaren" worden de contactpersonen per vestiging meegenomen naast de vergunninghoudende B.V. en UBO's.

## 2. Accountkoppeling van Michael

Het account `inkoop@smokery.nl` bestaat (aangemaakt 24 jul 2026) maar staat in Accountbeheer als "Geen koppeling". Het e-mailadres staat inmiddels wél in de lijst met toegestane adressen van lid 66; alleen ontbreekt de koppelrij die normaal bij registratie via de ledenaanmelding wordt gemaakt. Accounts die op een andere manier zijn ontstaan of die pas later toegang kregen, blijven daardoor los hangen.

**Oplossing**
- Nieuwe beveiligde databasefunctie die bij inloggen kijkt: heeft dit account een e-mailadres dat bij een lid hoort maar nog geen koppeling? Dan wordt de koppeling automatisch aangemaakt.
- Deze controle wordt bij het opstarten van de app aangeroepen, zodat bestaande accounts zichzelf herstellen.
- Eenmalige opschoning: alle bestaande accounts waarvan het e-mailadres bij een lid hoort krijgen direct de juiste koppeling (o.a. Michael → lid 66).
- Bestaand gedrag blijft: zodra een e-mailadres uit een lid wordt verwijderd, vervalt de toegang én de koppeling.

## Technische details

- `Contact` type uitbreiden met `locaties?: string[]` (locatie-identiteiten via `locationIdentity()` uit `src/lib/memberLocations.ts`).
- `MemberEditForm.tsx`: per contact een checkbox-lijst van `locaties`; opslaan loopt via de bestaande merge-route (`member_edits` / edit-request), geen overschrijving van basisdata.
- `MemberDetail.tsx`: contactkaart toont gekoppelde vestigingen; locatiekaart (`LocationRegisterInfo.tsx` of de omliggende kaart) toont de bijbehorende personen; `VergunninghoudersOverzicht.tsx` neemt de personen per vestiging mee.
- Migratie: `public.ensure_member_link()` (security definer, leest `auth.uid()` + e-mail uit de JWT-claim, matcht op `member_allowed_emails`, insert in `member_profiles` met `ON CONFLICT DO NOTHING`), plus een eenmalige backfill-insert voor bestaande accounts.
- `useAuth.tsx` roept `ensure_member_link()` aan na het laden van de sessie, vóór het ophalen van `member_profiles`.
