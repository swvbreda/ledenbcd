# Logo's verschijnen niet op de pagina Goedkeuringen

## Wat er aan de hand is

De gegevens kloppen: er staan 42 logo's van aangesloten coffeeshops klaar om te beoordelen.

De pagina kan ze alleen niet ophalen. Het logo-overzicht is het eerste onderdeel in deze app dat bij het ophalen een aparte beveiligde route gebruikt, en daarbij wordt je inlog op dit moment niet meegestuurd. Het verzoek wordt dus geweigerd. Omdat het scherm een mislukt verzoek niet van "niets gevonden" onderscheidt, zie je de melding dat er geen logo's wachten in plaats van een foutmelding.

## Wat ik ga doen

1. De inloggegevens meesturen bij deze beveiligde verzoeken, zodat het overzicht de logo's mag ophalen. De bestaande beveiliging van de app blijft ongewijzigd.
2. Het logo-overzicht een echte foutmelding laten tonen met een knop "Opnieuw proberen", zodat een probleem nooit meer als "geen logo's" wordt weergegeven.
3. Controleren in de preview dat de 42 logo's zichtbaar zijn, inclusief goedkeuren, afkeuren en uploaden.
4. Publiceren, zodat het ook op leden.coffeeshopbond.nl werkt.

## Technisch

- `src/start.ts`: `functionMiddleware: [attachSupabaseAuth]` toevoegen aan `createStart` (import uit `@/integrations/supabase/auth-attacher`); `requestMiddleware` met `errorMiddleware` en `csrfMiddleware` blijft ongewijzigd. Dit dekt alle functies met `requireSupabaseAuth` in `src/lib/shopLogo.functions.ts`.
- `src/components/register/LogoGoedkeuringPanel.tsx`: `isError`/`error` uit `useQuery` gebruiken voor een foutblok met `refetch()`.
- Verificatie via Playwright op localhost met een ingelogde sessie op `/goedkeuringen`.
