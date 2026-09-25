# Dubbele telling Joost Vriens corrigeren

## Probleem
Joost Vriens staat twee keer aangemeld voor de Experiment bijeenkomst: een keer als lid (John & Co, lid 100) en een keer als gast. De lijst toont hem nu maar één keer, maar het aantal aanmeldingen bovenaan telt hem nog dubbel en is daardoor 1 te hoog.

## Wat er verandert
- **Dubbele gastaanmelding weghalen:** de gastregistratie van Joost Vriens bij de Experiment bijeenkomst wordt verwijderd. Zijn ledaanmelding blijft gewoon staan. Er gaat geen mail of Outlook-bericht uit.
- **Telling waterdicht maken:** het aantal aanmeldingen telt gasten niet mee als hun shop al als lid is aangemeld. Zo kan dit bij een volgende bijeenkomst niet opnieuw gebeuren, ook al blijft zo'n dubbele aanmelding ooit in de gegevens staan.
- **Voorkomen bij het aanmelden:** in het aanmeldformulier kan een beheerder geen gast meer toevoegen voor een shop die al als lid is aangemeld voor die bijeenkomst.

## Technisch
- Verwijder één rij uit `agenda_guest_registrations` (Joost Vriens / John & Co, event Experiment 30 september). Geen andere rijen.
- `AgendaEventCard.tsx`: bij het berekenen van `totalGuests` dezelfde match toepassen als al in de lijstweergave gebeurt (gast overslaan als de genormaliseerde organisatienaam overeenkomt met een aangemeld lid).
- `AgendaDeelnemersDialog.tsx`: bij het kiezen van een registershop controleren of die shop al als lid is aangemeld; zo ja, tonen als "Al aangemeld" en niet kiesbaar als gast.
- Controle: aantal aanmeldingen bij de Experiment bijeenkomst klopt weer met de zichtbare lijst.

## Buiten scope
- Geen mails of Outlook-uitnodigingen.
- Geen publicatie; alleen preview.
