# Registercijfers kloppend maken + registerdata in de locatiekaarten

## 1. Waarom er nu 107 gemeenten staan

In het register staan 601 niet-vervallen shops, maar daar zitten ook vergunningen bij die (nog) geen werkende coffeeshop zijn. Gecontroleerd in de data:

| Status | Aantal |
|---|---|
| actief | 500 |
| verlengd | 31 |
| verleend | 16 |
| in_behandeling | 38 |
| aangevraagd | 12 |
| geweigerd | 3 |
| ingetrokken | 1 |

Alles wordt nu meegeteld → 601 shops en 107 gemeenten. Tellen we alleen vergunde shops (actief + verlengd + verleend), dan komen we op **547 shops en 101 gemeenten** — dat sluit aan bij het beeld van ~100 coffeeshopgemeenten.

### Wat er verandert
- Overal geldt één definitie van "coffeeshop in NL": niet vervallen én status actief/verlengd/verleend. Aanvragen, weigeringen en intrekkingen tellen niet mee in statistieken (ze blijven wel zichtbaar in het register met een statusfilter).
- De kaarten "Coffeeshops in NL", "Gemeenten", vertegenwoordigingspercentages, gemeentepagina's en de publieke cijfers gebruiken allemaal deze telling.

## 2. Registergegevens in de locatiekaarten

Nu staan de gekoppelde registershops in een apart blok "Gelieerde coffeeshops (register)" onder de locaties, waardoor dezelfde shop dubbel op de pagina staat (Hunters: 9 locaties + 6 registerregels).

### Wat er verandert
- Het aparte blok verdwijnt.
- Elke locatiekaart toont de registerkoppeling van díe vestiging (via de vestigingssleutel): registernaam, vergunninghouder/exploitant, vergunningnummer en -datum, en de UBO-keten, met een badge "Register bevestigd" of "Voorstel".
- Locaties zonder koppeling krijgen een subtiele melding "Niet gekoppeld aan register" met de bestaande koppel-/markeeractie.
- Registershops die aan het lid gekoppeld zijn maar (nog) niet aan een locatie hangen, verschijnen onderaan het locatieblok als kaart met label "Alleen in register" zodat er niets verloren gaat.

## Technische uitvoering

- Nieuwe helper `src/lib/registerActive.ts` met `VERGUND_STATUSSEN` en `isActiveShop(shop)`; gebruikt in `CoffeeshopRegisterPage.tsx`, `useRegisterStats.ts` en waar shops geteld worden.
- Migratie: `get_register_plaats_stats()` en `get_register_link_summary()` krijgen dezelfde statusfilter (`status IN ('actief','verlengd','verleend') AND vervallen = false`).
- `supabase/functions/public-stats` sluit aan op dezelfde filter zodat interne en publieke cijfers gelijk blijven.
- `src/pages/MemberDetail.tsx`: locatiekaarten samenvoegen met `coffeeshop_member_links` (join op `location_key`, fallback op adres/naam-match), `MemberRegisterShops` verwijderen uit de pagina; UBO-weergave hergebruiken.
- Registerstatus per shop wordt in de locatiekaart uit `coffeeshop_register` gelezen (bestaande hooks `useRegisterLinks` / `useCoffeeshopRegister`).
