# Agenda op datumvolgorde

De agenda toont voortaan overal strikt op datum: het eerstvolgende item bovenaan, ongeacht of het een vergadering of een evenement is.

## Wat er verandert

**Dashboard (blok Agenda)**
- De drie getoonde items worden eerst op datum en begintijd gesorteerd en daarna pas getoond, zodat het eerstvolgende item altijd bovenaan staat.

**Agendapagina**
- De volledige lijst met komende items wordt op datum en begintijd gesorteerd voordat hij per maand wordt gegroepeerd; ook de maanden zelf staan chronologisch.
- Het archief met afgelopen items staat omgekeerd: meest recente eerst.
- Een item dat via een gedeelde link geopend wordt, blijft bovenaan uitgelicht staan; de rest van de lijst volgt op datum.

## Technisch

- Eén gedeelde sorteerfunctie in `src/hooks/useAgenda.ts` (vergelijkt `event_date`, daarna `start_time`, lege tijd achteraan) die niet meer afhankelijk is van de volgorde die de database teruggeeft.
- Toepassen in `src/hooks/useAgenda.ts` (na ophalen), `src/components/agenda/AgendaDashboardCard.tsx` (voor de `slice(0, 3)`) en `src/pages/AgendaPage.tsx` (komende items, maandgroepen en archief).
- Geen database- of rechtenwijzigingen.
