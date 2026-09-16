# Links in evenementteksten klikbaar maken

Bij een evenement wordt de omschrijving nu als gewone tekst getoond. Een webadres of e-mailadres in die tekst blijft daardoor gewoon tekst: leden zien de link wel staan, maar kunnen er niet op tikken.

## Wat er verandert

- In de omschrijving van een evenement worden webadressen (ook zonder "https://", zoals `leapnl.weticket.io/...`) en e-mailadressen automatisch klikbaar.
- Links openen in een nieuw tabblad; e-mailadressen openen de mail-app.
- Lange links worden netjes afgebroken zodat ze op mobiel niet buiten het kader vallen.
- De rest van de tekst blijft precies zoals ingevoerd, inclusief de witregels.
- Dezelfde behandeling voor de omschrijving in de aankondigingsmail, zodat de link daar ook aanklikbaar is in plaats van kale tekst.

Alleen de weergave verandert; er hoeft niets aan bestaande evenementen te worden aangepast.

## Technisch

- Nieuw component `src/components/ui/LinkedText.tsx`: splitst een tekst met een regex op `https?://…`, `www.…`, bare domeinen met bekend TLD-patroon en `mailto`-achtige adressen, en rendert de stukken als tekst of `<a>` (`target="_blank" rel="noopener noreferrer"`, `break-words underline`). Geen `dangerouslySetInnerHTML`; alleen React-nodes, dus geen injectierisico. Afsluitende leestekens (`.`, `,`, `)`) blijven buiten de link.
- `AgendaEventCard.tsx` regel 138: `<p>{event.description}</p>` wordt `<LinkedText text={event.description} className="mt-3 whitespace-pre-line text-sm leading-relaxed" />`.
- `supabase/functions/_shared/transactional-email-templates/agenda-event-announcement.tsx`: `paragraphs(description)` krijgt dezelfde linkherkenning, met geëscapete tekst en `<a href>` in de HTML-mail.
- Unit-test voor de splitsfunctie (URL midden in zin, URL met haakje erachter, e-mailadres, tekst zonder link).
