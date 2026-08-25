# Agenda: afbeelding bij evenement + nette alinea's

## Wat er komt

1. **Afbeelding per agenda-item** — bij het toevoegen/bewerken van een agenda-item kun je een afbeelding (poster/flyer, zoals de "Open dag Tweede Kamer") uploaden. Die verschijnt op de agendakaart en op het dashboard-kaartje.
2. **Beschrijving met alinea's** — de omschrijving blijft nu één lap tekst. Regeleinden en witregels worden voortaan getoond zoals je ze typt, dus alinea's blijven staan.

## Technisch

- **Opslag**: nieuwe publieke bucket `agenda-images` (alleen beheerders mogen uploaden/verwijderen, iedereen mag lezen).
- **Database**: kolom `image_url text` toevoegen aan `agenda_events`.
- **`src/hooks/useAgenda.ts`**: `image_url` opnemen in het type en in opslaan; kleine upload-helper naar de bucket.
- **`AgendaEventDialog.tsx`**: bestandsveld met voorbeeldweergave, wissen-knop; upload gebeurt bij opslaan.
- **`AgendaEventCard.tsx`**: afbeelding bovenaan de kaart (responsief, afgeronde hoeken, klikbaar voor groot formaat); omschrijving met `whitespace-pre-line`.
- **`AgendaDashboardCard.tsx`**: kleine thumbnail links naast het item als er een afbeelding is.

## Nog even checken

- De poster van 12 september: wil je dat ik dat evenement er meteen bij zet (Open dag Tweede Kamer, zaterdag 12 september, 11.00–16.00 uur, met deze afbeelding en aanmelden aan)? Zo ja, dan voeg ik het item toe zodra de functionaliteit staat.
