# Voorstel bevestigen vindbaar maken in het Coffeeshopregister

## Wat er aan de hand is

Er staat inderdaad één openstaand voorstel: **Easy Times (Amsterdam)** → lid #20, reden "Exploitant: Easy Times B.V.", zekerheid 85%.

De knop om te bevestigen bestaat wel, maar staat alleen in de rij van die shop, ergens tussen de 604 registerrijen in de tabel. De teller "Voorstellen te bevestigen" doet niets als je erop klikt, en het filter staat standaard op "Alle shops". Daardoor is het voorstel praktisch onvindbaar.

## Oplossing

1. **Blok bovenaan met openstaande voorstellen**
   Zodra er voorstellen zijn, verschijnt boven de tabel een kaart per voorstel met de registergegevens, het voorgestelde lid, de matchreden en het percentage, plus knoppen "Controleren en bevestigen" en "Afwijzen". Het blok verdwijnt zodra alles is afgehandeld.

2. **Tellers worden klikbaar**
   Klikken op "Voorstellen te bevestigen" zet het filter op Voorstellen; "Gekoppeld aan leden" en "Vergunde coffeeshops in NL" zetten hun eigen filter. Actieve teller krijgt een accentrand.

3. **Tabel: rij van een voorstel licht op**
   Rijen met een openstaand voorstel krijgen een subtiele markering, zodat ze ook in de volledige lijst opvallen.

## Technisch

- `src/pages/CoffeeshopRegisterPage.tsx`: nieuw blok boven de filterbalk dat de shops met `link.status === "voorstel"` toont; hergebruikt de bestaande `ConfirmLinkDialog` en `useSetRegisterLink` (bevestigen/afwijzen), dus geen nieuwe backend-logica.
- Tellerkaarten worden buttons die `koppeling` (en waar nodig `vergunning`) instellen.
- Presentatie van de kaarten volgt het bestaande patroon van `src/components/register/RegisterLinkApprovals.tsx`.
- Geen databasewijzigingen.
