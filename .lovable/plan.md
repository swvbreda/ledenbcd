# Agenda-kaart op het dashboard moderniseren

Gekozen richting: **Modern elevated list** — rustige vergaderrijen, met het evenement als volledig uitgelichte kaart met poster.

## Wat er verandert

- **Kop**: rood afgerond icoonvlak met kalendericoon, "Agenda" in Archivo Black, en "Alles bekijken" met pijltje dat bij hover inschuift.
- **Vergaderingen** (Bestuursvergadering): rustige rij met zachte achtergrond, afgeronde hoeken, grijze badge "Vergadering", en datum/tijd/locatie/aanmeldingen met kleine rode iconen. Rechts een "Details"-knop.
- **Evenementen**: echt uitgelicht als eigen kaart met rode rand en zachte rode gloed. Poster staat links over de volle hoogte (zoomt licht in bij hover), titel groot in Archivo Black met ronde rode badge "Evenement", en de gegevens in een tweekolomsrooster met rode icoonvlakjes. Rechts een rode actieknop "Aanmelden" die naar de agenda leidt.
- Evenementen zonder poster tonen dezelfde uitgelichte kaart, maar dan zonder afbeeldingskolom.
- Alles blijft klikbaar naar de agendapagina; op mobiel stapelt de kaart netjes (poster boven, gegevens daaronder).

## Wat gelijk blijft

- Dezelfde data: titel, type, datum, tijdsrange, locatie, aantal aangemeld, poster.
- Zelfde 3 eerstvolgende items, zelfde link naar /agenda, geen nieuwe functionaliteit.

## Technisch

- Alleen `src/components/agenda/AgendaDashboardCard.tsx` wordt herschreven.
- Kleuren via bestaande semantische tokens (`primary`, `brand-red`, `muted`, `border`) — geen hardgecodeerde hexwaarden; `font-display` voor koppen.
- `AgendaThumb` wordt uitgebreid naar een postervariant over de volle hoogte (`object-cover`), met fallback als er geen afbeelding is.
