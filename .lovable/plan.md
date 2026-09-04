# Vertrouwde deel-link met openbare preview

Nu wordt een lang technisch functie-adres gedeeld (`https://txbfdrriwaynfeurqkea.supabase.co/functions/v1/agenda-share/DTHLAU`). Dat oogt onbetrouwbaar. Sinds de upgrade naar server-rendering kan de link gewoon op het eigen domein staan, met een echte preview.

## Wat je krijgt

**Korte, herkenbare link**
- Gedeeld wordt voortaan `https://leden.coffeeshopbond.nl/a/DTHLAU`.
- In WhatsApp verschijnt een preview met titel van het agendapunt, datum, tijd, locatie en het BCD-logo.

**Openbare uitnodigingspagina**
- Wie de link opent (ook zonder account) ziet een nette pagina in de huisstijl: titel, datum, tijd, locatie en een korte uitleg dat dit een uitnodiging van de Bond van Cannabis Detaillisten is.
- Geen deelnemerslijst, geen interne notities, geen ledengegevens — alleen de vier openbare velden.
- Knop **"Inloggen en aanmelden"**. Na inloggen (en MFA) komt de bezoeker automatisch bij dit agendapunt uit met de aanmeldknop in beeld.
- Ben je al ingelogd, dan word je direct doorgestuurd naar het agendapunt in het portaal.
- Onbekende code: nette melding met link naar de agenda.

**Oude links blijven werken**
- Het bestaande functie-adres blijft bestaan en stuurt door naar de nieuwe pagina.

## Technisch

- Nieuwe publieke route `src/routes/a.$shareCode.tsx` (buiten `_dashboard`), met een loader die via de bestaande RPC `get_agenda_share` alleen titel, datum, start/eind en locatie ophaalt, en een `head()` met title, description, `og:*`, `twitter:*` en canonical op `https://leden.coffeeshopbond.nl/a/CODE`.
- De huidige beveiligde route `src/routes/_dashboard/a.$shareCode.tsx` wordt verwijderd (conflicteert met hetzelfde pad); de ingelogde weergave verloopt via doorsturen naar `/agenda/<id>`.
- Publieke lezing gebeurt server-side met de publishable key; RPC is al `security definer` en geeft alleen deelvelden terug.
- `AgendaShareButton.buildShareUrl` wijst naar `https://leden.coffeeshopbond.nl/a/<code>` in plaats van het functie-adres.
- `supabase/functions/agenda-share` blijft als redirect-fallback voor eerder verstuurde links.
- Aanmelden blijft volledig achter de login; de openbare pagina bevat geen aanmeldactie zelf.

## Let op

Previews verschijnen pas op het live adres na publiceren; na oplevering test ik de tags zoals WhatsApp ze ophaalt.
