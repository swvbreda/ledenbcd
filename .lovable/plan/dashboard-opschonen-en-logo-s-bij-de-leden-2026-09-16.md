# Dashboard opschonen en logo's bij de leden

## Wat er verandert

**1. Kerngegevens op het dashboard**
- Het blok "Vestigingen 163" verdwijnt. Dat getal kwam uit de handmatig ingevulde vestigingen in het ledenbestand en botste met de 174 erboven, dus het levert alleen verwarring op.
- Het blok "Gekoppeld aan register" verdwijnt volledig.
- Geen enkele tekst noemt nog het register: "vertegenwoordigd via het register" wordt "aangesloten coffeeshops".

Wat blijft staan: aangesloten coffeeshops (174), gemiddeld aantal per ondernemer, aantal gemeenten, peildatum.

**2. Logowand weg**
Het blok "Aangesloten coffeeshops" met alle losse logo-tegels verdwijnt van het dashboard.

**3. Logo's bij de leden**
- In de ledenlijst staat bij elk lid het eigen logo als miniatuur. Die wordt iets groter en duidelijker, zodat je het logo ziet in plaats van de letters.
- Alleen als er echt geen logo is, blijven de initialen staan.
- Op de ledenpagina zelf komt het logo bovenaan bij de naam te staan, in plaats van de lettertegel.
- Handmatig geüploade logo's houden voorrang; verder wordt het automatisch opgehaalde logo gebruikt, zonder dat ergens zichtbaar is waar het vandaan komt.

## Technisch

- `src/components/KerngegevensSummary.tsx`: kaarten "Vestigingen" en "Gekoppeld aan register" verwijderen, hint van de eerste kaart aanpassen, grid naar 3 kolommen; `useKerngegevens`-velden die niet meer gebruikt worden laten staan (kerngegevenspagina gebruikt ze).
- `src/pages/Index.tsx`: `LogoWall` import en gebruik verwijderen; `src/components/LogoWall.tsx` verwijderen.
- `src/components/MemberTable.tsx`: `LogoThumb` groter (lijst 36px, mobiel 40px) en met witte achtergrond; bestaande voorrangsregel (upload > registerlogo) ongewijzigd.
- `src/pages/MemberDetail.tsx`: logo-miniatuur naast de naam, met initialen als fallback, via dezelfde bronnen (`useMemberLogosBulk` / `useRegisterLogos`).
