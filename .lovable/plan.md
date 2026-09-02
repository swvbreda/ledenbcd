# Locatiekaarten opschonen in het ledenprofiel

Doel: geen dubbele adresgegevens, een rustig verificatievinkje in plaats van een badge, en geen ophaalknoppen meer in het ledenprofiel — dat gebeurt voortaan alleen op de registerpagina.

## Wijzigingen

1. **Dubbel adres weg**
   In het blok "Register" onderaan de kaart verdwijnt de regel "Dossier" (naam · adres · plaats). Het adres staat al bovenaan de kaart. Vergunning en status blijven staan.

2. **Rood vinkje in plaats van badge**
   De badge "Bevestigd" wordt vervangen door een klein rood vinkje naast de kop "Register". Een nog niet bevestigde koppeling blijft herkenbaar als "Voorstel"; niet-gekoppeld toont geen vinkje.

3. **Knoppen "Bijwerken vanuit register" verwijderen**
   Zowel de knop per locatiekaart als de knop bovenaan het ledenprofiel verdwijnen. Verrijken blijft mogelijk vanaf de coffeeshopregisterpagina en draait verder automatisch.

## Technisch

- `src/components/register/LocationRegisterInfo.tsx`: Dossier-`Row` verwijderen; badge vervangen door een `Check`-icoon met `text-brand-red` (titel + tooltip "Geverifieerd via register"), fallback-label voor voorstelstatus.
- `src/pages/MemberDetail.tsx`: beide `runEnrichment`-knoppen en ongebruikte imports (`RefreshCw`, `useRunRegisterEnrichment`) verwijderen.
