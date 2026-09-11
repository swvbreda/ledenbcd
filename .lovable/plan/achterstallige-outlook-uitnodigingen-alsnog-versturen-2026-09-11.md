# Achterstallige Outlook-uitnodigingen alsnog versturen

Doel: iedereen die zich al eerder heeft aangemeld voor een komend evenement, alsnog een echte Outlook-agenda-uitnodiging bezorgen. Er gaat hierbij geen enkele e-mail vanuit het ledenportaal uit — alleen de agenda-uitnodiging vanuit Outlook.

## Wat er nu misgaat

De bestaande afspraken in de Outlook-agenda zijn destijds aangemaakt zonder uitnodigingsverzoek. Bij Microsoft staat bij die afspraken "geen antwoord gevraagd" en bij alle deelnemers staat de reactie op "geen" — er is dus nooit een uitnodiging bij hen bezorgd. Dit geldt onder meer voor: CannaPro 2026, Rotterdam Gastvrij, Experiment bijeenkomst, Kortgeding tegen Worldline en de LEAP-filmvertoning.

Alleen opnieuw synchroniseren is niet genoeg: Microsoft ziet dat als een kleine wijziging en stuurt niet altijd alsnog een uitnodiging naar deelnemers die er nooit één kregen.

## Aanpak

Een eenmalige inhaalactie voor komende, niet-geannuleerde evenementen:

1. Zoek alle komende evenementen die al in Outlook staan en waarbij nog niemand op de uitnodiging heeft gereageerd.
2. Verwijder de oude afspraak bij Microsoft en maak hem opnieuw aan, nu mét uitnodigingsverzoek en met exact dezelfde titel, datum, tijd, locatie en omschrijving.
3. Alle huidige aangemelde deelnemers komen als genodigde op de nieuwe afspraak, waardoor Microsoft de uitnodiging daadwerkelijk verstuurt.
4. Sla het nieuwe Outlook-nummer op bij het evenement, zodat latere aanmeldingen gewoon aan dezelfde afspraak worden toegevoegd.
5. Controleer daarna bij Microsoft per evenement of het uitnodigingsverzoek nu wel aanstaat en hoeveel genodigden erop staan.

De inhaalactie raakt uitsluitend de agenda. De bevestigingsmails uit het ledenportaal worden hierbij niet verstuurd.

## Bestuurders merken hiervan

Deelnemers ontvangen één agenda-uitnodiging per evenement waar zij voor aangemeld staan. Voor de zekerheid gebeurt dit alleen voor evenementen in de toekomst — afgelopen items blijven ongemoeid.

## Technische uitvoering

- Nieuw beveiligd endpoint `src/routes/api/public/agenda-outlook-backfill.ts` (zelfde `x-internal-secret`-beveiliging als `agenda-outlook-sync`), dat over de komende, niet-geannuleerde `agenda_events` met een `outlook_event_id` loopt.
- Per evenement: Graph `GET /users/{mailbox}/events/{id}` om `responseRequested` en `attendees[].status.response` te lezen; alleen doorgaan als er nog geen enkele reactie is (invitations nooit aangekomen).
- Deelnemerslijst wordt opnieuw opgebouwd uit `agenda_registrations` met dezelfde logica als in `agenda-outlook-sync.ts` (contact-e-mail, ledenmail, bestuursmail).
- `DELETE` van de oude Graph-afspraak, daarna `POST /users/{mailbox}/events` met `responseRequested: true` en de volledige attendee-lijst; `outlook_event_id` en `outlook_synced_at` worden bijgewerkt.
- Resultaten per evenement in `outlook_sync_log` met `trigger: "agenda-outlook-backfill"` en verificatiegegevens.
- Uitvoeren via de bestaande beveiligde databasefunctie-route (`pg_net`), niet vanuit de browser. De app moet eerst gepubliceerd zijn, omdat het endpoint op de live site draait.
- Geen aanroepen naar `send-transactional-email` in deze flow.
