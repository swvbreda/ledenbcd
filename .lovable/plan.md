# Evenement of bijeenkomst kiezen bij declaratie

Boven "Omschrijving" komt een nieuw keuzeveld: **Evenement / bijeenkomst (optioneel)**.

## Hoe het werkt
- De lijst toont evenementen en bijeenkomsten uit de Agenda van de afgelopen 3 maanden en de komende maand. Ze staan op datum, de nieuwste bovenaan, en geannuleerde evenementen staan er niet in.
- Elke regel toont de datum, de titel en de locatie.
- Kies je een evenement, dan wordt automatisch ingevuld:
  - **Omschrijving:** de titel van het evenement
  - **Datum:** de datum van het evenement
  - **Naar:** de locatie, maar alleen als je dat veld nog niet zelf hebt ingevuld
- Alle velden kun je daarna nog zelf aanpassen.
- Je kunt ook "Geen evenement" kiezen en alles zelf invullen, zoals nu.
- Vul je Van en Naar in, dan wordt de afstand automatisch berekend, zoals nu.

## Technische details
- Bestand: `src/components/budget/InternalDeclarationsView.tsx`.
- `agenda_events` wordt gelezen (title, event_date, location, cancelled_at is null) via de bestaande Lovable Cloud-client. Dat gebeurt met dezelfde leesrechten die de Agenda al gebruikt, zonder wijzigingen aan de database.
- De gekozen evenement-id wordt alleen in het formulier bewaard; er wordt geen nieuwe kolom aangemaakt.
- Wordt alleen in de preview gezet, niet gepubliceerd.
