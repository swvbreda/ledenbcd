# Koppelvoorstellen begrijpelijk maken

## Probleem

In de registerlijst zie je bij een voorstel alleen de badge "Goa (voorstel)" met een vinkje en een kruisje. Waarom het systeem die match voorstelt is nergens zichtbaar, en de gegevens van het lid staan er niet naast. Bij twee shops met dezelfde naam (Goa Amsterdam en Goa Leiden) is dan niet te bepalen welke de juiste is.

Wat er in de data wel staat, maar niet getoond wordt:
- Goa (Amsterdam, Kloveniersburgwal 42) → lid Goa, reden "Adres (postcode + huisnummer)", zekerheid 95%
- Goa (Leiden, Korte Mare 8) → lid Goa, reden "Alleen naam", zekerheid 60%

Happy People (Amsterdam, Dapperstraat 2) heeft op dit moment geen voorstel en geen koppeling — die shop moet handmatig aan het juiste lid gekoppeld kunnen worden. Een handmatige koppeloptie ontbreekt in deze lijst.

## Wat er komt

1. **Reden en zekerheid in de lijst**
   Bij elk voorstel komt achter de badge de matchreden en het percentage, bijvoorbeeld "Adres (postcode + huisnummer) · 95%" of "Alleen naam · 60%". Zwakke matches (onder 70%) krijgen een waarschuwingskleur.

2. **Bevestigen gaat via een vergelijkingsvenster**
   Klikken op het vinkje opent eerst een venster met links de registergegevens (naam, adres, plaats, vergunninghouder, KvK) en rechts de gegevens van het voorgestelde lid (naam, locaties met adres en plaats, KvK). Verschillen worden gemarkeerd. Pas na "Koppeling bevestigen" wordt de koppeling vastgelegd. Afwijzen kan direct vanuit hetzelfde venster.

3. **Handmatig koppelen**
   Bij shops zonder koppeling (zoals Happy People) komt een knop "Koppel aan lid" met een zoekveld door het ledenbestand, zodat je zelf het juiste lid en de juiste locatie kiest.

## Technisch

- `src/pages/CoffeeshopRegisterPage.tsx`: kolom "Lid" toont reden + score uit `coffeeshop_member_links.match_reden` / `match_score`; vinkje opent het nieuwe dialoogvenster in plaats van direct `setLink.mutate`.
- Nieuw `src/components/register/ConfirmLinkDialog.tsx`: side-by-side vergelijking register vs. lid (uit `useMembersData`, inclusief `locaties`), met acties bevestigen / afwijzen / annuleren via de bestaande `useSetRegisterLink`.
- Handmatig koppelen hergebruikt hetzelfde dialoogvenster met een lidzoeker (Command/combobox) en schrijft een link met status `bevestigd`.
- Geen databasewijzigingen nodig; alle benodigde velden bestaan al.
