# Bevestigingsmail bij aanmelding voor een agenda-item

Zodra iemand zich aanmeldt voor een evenement of bestuursvergadering, krijgt het lid automatisch een bevestigingsmail met alle details.

## Wat de ontvanger krijgt

- Onderwerp: "Aanmelding bevestigd: {titel van het item}"
- Inhoud: titel, datum, tijd, locatie, aantal personen, eventuele opmerking en de omschrijving van het item.
- Knop "Bekijk in de agenda" die naar het ledenportaal linkt.
- Vormgeving in BCD-huisstijl (rood accent, Archivo Black-achtige koppen, witte achtergrond).

## Wanneer wordt hij verstuurd

- Bij een nieuwe aanmelding — ook wanneer het bestuur iemand namens het lid aanmeldt.
- Bij het wijzigen van een bestaande aanmelding (aantal personen/opmerking) wordt géén nieuwe mail gestuurd.
- Bij afmelden wordt geen mail gestuurd.

## Naar welk adres

Het e-mailadres van het lid, in deze volgorde:
1. de bij het lid geregistreerde inlogadressen (`member_allowed_emails`),
2. anders het hoofd-e-mailadres uit het ledenbestand.

Zijn er meerdere inlogadressen? Dan gaat de bevestiging naar alle adressen van dat lid. Heeft een lid/lead geen e-mailadres, dan wordt er niets verstuurd en verschijnt er een subtiele melding in de aanmeldknop ("aanmelding opgeslagen, geen e-mailadres bekend").

## Technische uitwerking

- Nieuw template `agenda-registration-confirmation.tsx` in `supabase/functions/_shared/transactional-email-templates/`, geregistreerd in `registry.ts`. Props: `siteName`, `eventTitle`, `eventDate`, `eventTime`, `location`, `guests`, `note`, `description`, `eventUrl`.
- Verzenden via de bestaande functie `send-transactional-email` met een idempotency key `agenda-reg-{registration_id}`, zodat een dubbele klik geen dubbele mail geeft.
- In `src/hooks/useAgenda.ts` geeft de `register`-mutatie voortaan het aangemaakte registratie-id terug (`.select("id").single()`); daarna wordt de mail aangeroepen. Mislukt het versturen, dan blijft de aanmelding gewoon staan en verschijnt alleen een waarschuwing.
- Adres opzoeken via een kleine helper die `member_allowed_emails` en het ledenbestand raadpleegt.
- Na de wijziging worden de edge functions opnieuw uitgerold.

## Controle achteraf

Testaanmelding doen op een agenda-item en in het e-maillogboek controleren dat de mail als verzonden is geregistreerd.
