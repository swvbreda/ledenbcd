# Eén waarheid voor het aantal coffeeshops

## Waarom de getallen verschillen

De twee kaarten tellen niet hetzelfde:

| | Dashboard (183) | Kerngegevens (117 / 164) |
|---|---|---|
| Wie telt mee | leden **én** leads (122) | alleen leden (117) |
| Wat telt mee | bevestigde koppelingen met het coffeeshopregister (142) plus de vestigingen uit het ledenbestand die nog geen koppeling hebben | alleen de vestigingen zoals ingevuld in het ledenbestand |

Gecontroleerd in de database: 117 leden met 167 vestigingen, 5 leads met 6 vestigingen, 142 bevestigde registerkoppelingen. Geen enkel lid heeft meer koppelingen dan vestigingen, dus er is geen dubbeltelling — het verschil komt puur doordat het dashboard leads meetelt en registervestigingen meeneemt die nog niet als locatie bij het lid staan.

Kortom: allebei kloppen, maar ze beantwoorden een andere vraag. Dat is verwarrend en moet één verhaal worden.

## Wat ik ga doen

1. **Kerngegevens krijgt hetzelfde vertegenwoordigingscijfer** als het dashboard, als extra kaart "Vertegenwoordigde coffeeshops", uit dezelfde bron (het register).
2. **De bestaande kaarten krijgen een duidelijk label**: "Leden" en "Vestigingen (ledenbestand)", zodat zichtbaar is dat dit alleen de eigen ingevulde gegevens van leden zijn.
3. **De dashboardkaart krijgt een uitleg-regel** onder het getal: hoeveel daarvan bevestigde registerkoppelingen zijn en hoeveel uit het ledenbestand komen, plus dat leads meetellen.
4. Beide pagina's gebruiken dezelfde peildatum/verversmoment, zodat de cijfers niet uit elkaar kunnen lopen.

## Technisch

- `src/pages/KerngegevensPage.tsx`: `useRegisterStats()` toevoegen en een kaart met `totaalRepresented`; labels van de bestaande kaarten aanscherpen.
- `src/components/StatCards.tsx`: onder "Vertegenwoordigde Coffeeshops" een subregel met de opsplitsing (`gekoppeldeRegistershops` en `nietGekoppeldeLocaties` uit `useRegisterStats`).
- Geen wijziging aan `get_representation_stats` of `public-stats`; de telling zelf blijft zoals hij is.
