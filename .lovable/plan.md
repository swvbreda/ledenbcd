# Leden & betalingen verplaatsen naar Financiën (admin-only)

## Wat er nu misgaat

Bevestigd in de code:
- `/leden-betalingen` staat in `src/App.tsx` binnen de gewone beveiligde routes — dus **elk ingelogd account** (ook gewone leden) kan de pagina openen, inclusief contributiebedragen en betaalstatus van alle leden.
- De link "Leden & betalingen" staat in `src/components/AppSidebar.tsx` in de algemene `navItems`, dus zichtbaar voor iedereen.
- Ter vergelijking: `/financien` is wél afgeschermd (`if (!isAdmin) return <Navigate to="/" replace />`) en de sidebar-link staat in het admin-blok.

## Wat ik ga doen

1. Het overzicht wordt een tabblad **"Leden & betalingen"** binnen Financiën, naast Dashboard / Declaraties / Contributie / etc.
2. De losse pagina verdwijnt:
   - sidebar-item verwijderen uit de algemene navigatie;
   - de route `/leden-betalingen` vervangen door een redirect naar `/financien`, zodat oude links/bookmarks van niet-admins niet in een 404 maar op de normale admin-check landen.
3. De inhoud (KPI-kaarten, zoekbalk, statusfilters, tabel) blijft ongewijzigd; alleen de eigen hero-banner en de eigen jaarknoppen vervallen — het tabblad volgt de jaarkeuze die al bovenaan de Financiën-pagina staat.

Resultaat: de betalingsgegevens zijn alleen nog zichtbaar voor beheerders, op precies één plek.

## Technisch

- `src/pages/LedenBetalingenPage.tsx` wordt omgebouwd tot `src/components/budget/LedenBetalingenTab.tsx` met een `year: number` prop (geen eigen jaar-state, geen `BcdHeroBanner`).
- `src/pages/FinancienPage.tsx`: extra `TabsTrigger value="leden-betalingen"` + `TabsContent` die de nieuwe component rendert met de bestaande `year`.
- `src/App.tsx`: import van de oude pagina weg; route wordt `<Route path="/leden-betalingen" element={<Navigate to="/financien" replace />} />`.
- `src/components/AppSidebar.tsx`: item "Leden & betalingen" uit `navItems` halen.

Let op: dit is een UI-/toegangswijziging in de frontend. De onderliggende leesrechten op contributiegegevens in de database blijven zoals ze zijn — zeg het als je die ook wilt beperken tot bestuur/penningmeester.
