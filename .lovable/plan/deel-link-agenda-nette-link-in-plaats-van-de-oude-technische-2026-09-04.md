# Deel-link agenda: nette link in plaats van de oude technische link

## Wat je ziet
In je screenshot staat twee keer de oude, technische link
(`txbfdrriwaynfeurqkea.supabase.co/functions/v1/agenda-share/DTHLAU`).
De huidige, live versie van het ledenportaal maakt al de korte link
`https://leden.coffeeshopbond.nl/a/DTHLAU`. Dat is gecontroleerd in de
live bestanden van de site. De oude link komt dus uit een oude versie
die nog in je browser hangt (of uit een eerder gekopieerd bericht).

## Wat ik ga doen

1. **Oude versie uitsluiten** — de pagina-instellingen zo zetten dat je
   browser niet met een oude versie van de agenda kan blijven werken, en
   controleren dat de deelknop op je computer de korte link geeft.
2. **Deelknop verduidelijken** — voordat je deelt zie je de link die
   verstuurd wordt, zodat direct zichtbaar is dat het de nette
   `leden.coffeeshopbond.nl/a/CODE` link is.
3. **Bericht netter maken** — bij delen via WhatsApp komt eerst de titel
   met datum, tijd en locatie, daarna één keer de link (nooit dubbel).
4. **Oude link laten werken** — wie nog een oud bericht met de oude link
   heeft, wordt automatisch doorgestuurd naar de nette uitnodigingspagina.
5. **Controleren en publiceren** — testen met code `DTHLAU` en daarna
   publiceren, zodat de wijziging ook echt op de site staat.

## Technisch
- `src/components/agenda/AgendaShareButton.tsx`: link zichtbaar in het
  deelmenu, WhatsApp-tekst opbouwen als titel/datum/tijd/locatie + één URL.
- Cache-headers/versiecontrole zodat oude bundels niet blijven hangen.
- `supabase/functions/agenda-share/index.ts`: 301-redirect naar
  `https://leden.coffeeshopbond.nl/a/<CODE>` voor oude gedeelde links.
- Verificatie: SSR-preview van `/a/DTHLAU` (titel, datum, afbeelding) en
  handmatige test van de deelknop in de browser.
