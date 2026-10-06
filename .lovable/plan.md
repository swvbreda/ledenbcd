# Declaratieformulier: rekeningnummer en bedrag automatisch

## 1. Rekeningnummer automatisch invullen
- Bij bestuursleden staat nu nog geen rekeningnummer opgeslagen. Daarom vult het formulier het rekeningnummer in van de **laatste declaratie van het gekozen bestuurslid**.
- Kies je jezelf, dan verschijnt jouw nummer. Kies je iemand anders, dan verschijnt diens nummer, en de rekeninghouder wordt die persoon.
- Heeft iemand nog nooit gedeclareerd, dan blijft het veld leeg. Na de eerste declaratie wordt het nummer daarna steeds vanzelf ingevuld.
- Je kunt het nummer altijd nog aanpassen.

## 2. Bedrag automatisch berekenen
- De afstand wordt vanzelf berekend zodra "Van" en "Naar" allebei zijn ingevuld. Je hoeft dus niet meer op "Bereken afstand" te klikken. De knop blijft wel staan.
- Er komt een veld **"Km (totaal)"** bij. Weet je het aantal kilometers al, dan typ je het daar zelf in. Het bedrag wordt dan direct uitgerekend: km x € 0,23.
- "Heen en terug" aan- of uitzetten past het bedrag meteen aan.
- Het bedrag staat zichtbaar in het groene vak boven de knop "Declaratie indienen".

## Technische details
- `InternalDeclarationsView.tsx`: in `chooseMember` het `bank_account` van de meest recente declaratie met hetzelfde `board_member_id` (of dezelfde naam) zoeken. Bron: de lijst met declaraties van het lopende jaar. Valt die leeg uit, dan een kleine extra query zonder jaarfilter.
- De route automatisch berekenen met een debounce (ongeveer 800 ms) op origin/destination. Handmatige km zet `oneWayKm` (totaal / 2 bij heen en terug). Het bestaande `calculateTravelDeclaration` blijft de bron voor het bedrag.
- Geen database- of toegangswijzigingen. Er wordt niets gepubliceerd.
