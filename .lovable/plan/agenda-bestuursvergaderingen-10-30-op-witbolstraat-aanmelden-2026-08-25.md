# Agenda: bestuursvergaderingen 10:30 op Witbolstraat + aanmelden openen

Alle bestuursvergaderingen starten voortaan om **10:30 uur** op de **Witbolstraat**. Leden moeten zich net als bij evenementen kunnen aanmelden voor deze vergaderingen.

## Wat er verandert

- **Genereren van vergaderingen**: standaardtijd wordt **10:30**, locatie wordt **Witbolstraat**.
- **Aanmelden voor bestuursvergaderingen**: de aanmeldknop, wijzigen/afmelden en de "Volgeboekt"-status worden niet meer beperkt tot het type `evenement`, maar werken voor alle agenda-items.
- **Deelnemersbeheer**: de "Deelnemers"-knop in de admin-weergave is beschikbaar voor elk item, niet alleen evenementen.
- **Dashboardkaart**: toont ook voor vergaderingen hoeveel leden zich hebben aangemeld.
- **Dialoog**: het maximum aantal plaatsen blijft instelbaar voor beide typen, inclusief bestuursvergaderingen.

## Technisch

Te wijzigen bestanden:
- `src/hooks/useAgenda.ts` — `generateMeetings` aanpassen (`start_time: "10:30"`, `location: "Witbolstraat"`, `end_time: "12:30"` als afsluitende richtlijn).
- `src/components/agenda/AgendaEventCard.tsx` — verwijder de `isEvent` voorwaarde rond aanmelden, deelnemers en aantal-aangemeld.
- `src/components/agenda/AgendaDashboardCard.tsx` — toon aantal aangemeld voor zowel evenementen als vergaderingen.
- `src/components/agenda/AgendaEventDialog.tsx` — max. plaatsen en locatie blijven altijd zichtbaar, onafhankelijk van type.

Geen database-wijzigingen nodig; de tabellen `agenda_events` en `agenda_registrations` ondersteunen dit al.
