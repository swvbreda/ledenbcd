# Nette deel-links en echte linkpreview voor agendapunten

Nu wordt een lange UUID-link gedeeld (`/agenda/861ea485-e469-...`) en toont WhatsApp de algemene portaal-preview. Dit wordt een korte code plus een preview met de vergadergegevens.

## Wat de gebruiker ziet

- Deel-link wordt kort, bijvoorbeeld `.../a/K7X2QM` in plaats van de UUID.
- WhatsApp/iMessage-preview toont: titel van het agendapunt, datum, tijd en locatie, met het BCD-logo.
- Wie op de link tikt, komt direct op de agendapagina van dat punt in het ledenportaal (inloggen werkt zoals nu).
- De oude UUID-links blijven werken.

## Aanpak

1. **Korte code per agendapunt**
   - Kolom `share_code` op `agenda_events` (uniek, 6 tekens, hoofdletters/cijfers zonder verwarrende tekens), automatisch gevuld bij aanmaken en bestaande punten eenmalig bijgewerkt.
   - Publieke leesfunctie (RPC) die alleen titel, datum, tijd, locatie en id teruggeeft bij een code — geen deelnemers of interne notities.

2. **Preview-endpoint**
   - Nieuwe edge function `agenda-share` (zonder login) serveert een minimale HTML-pagina met per agendapunt gevulde `og:title`, `og:description`, `og:url`, `og:image` en twitter-tags.
   - Echte bezoekers worden meteen doorgestuurd naar `https://leden.coffeeshopbond.nl/a/<code>`; crawlers krijgen de meta-tags.
   - De gedeelde URL is de functie-URL met de korte code erachter; dat is de enige manier om een gevulde preview te krijgen, omdat de hosting van het ledendomein voor elk pad dezelfde statische pagina uitlevert.

3. **Routing in de app**
   - Route `/a/:code` naast de bestaande `/agenda/:eventId`; de code wordt omgezet naar het agendapunt en dezelfde pagina opent.

4. **Deelknop**
   - `AgendaShareButton` gebruikt voortaan de korte preview-link voor kopiëren, WhatsApp, e-mail en native delen, met dezelfde begeleidende tekst.

## Technisch

- Migratie: kolom + unieke index + `GRANT`s + RPC `get_agenda_share(code text)` als `security definer` met vaste `search_path`.
- Edge function met `verify_jwt = false`, HTML-escaping van titel/locatie, `Cache-Control` kort zodat wijzigingen snel doorkomen.
- Fallback: onbekende code stuurt door naar de agenda-overzichtspagina.
