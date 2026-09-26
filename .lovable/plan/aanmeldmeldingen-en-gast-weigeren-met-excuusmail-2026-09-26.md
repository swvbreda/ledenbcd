# Aanmeldmeldingen en gast weigeren met excuusmail

## 1. Melding bij elke nieuwe aanmelding
- Bij elke nieuwe aanmelding voor een bijeenkomst (lid of niet-lid via de deellink) gaat:
  - een korte mail naar **info@coffeeshopbond.nl** met bijeenkomst, shop, naam, e-mail, aantal personen en of het een lid is;
  - een app-melding naar de telefoons van bestuur/beheer: "Nieuwe aanmelding: [shop] voor [bijeenkomst]".
- Alleen bij een nieuwe aanmelding, niet bij wijzigen. Maximaal één melding per aanmelding.

## 2. Niet-lid verwijderen met excuusmail
- In het deelnemersoverzicht krijgt elke gastaanmelding de knop **"Weigeren en mailen"** (naast gewoon verwijderen zonder mail).
- Een venster toont de mailtekst, die je nog kunt aanpassen. Standaard:
  > Beste [naam], bedankt voor je aanmelding voor [bijeenkomst] op [datum]. Helaas is deze bijeenkomst alleen toegankelijk voor aangesloten coffeeshopondernemers van de Bond. Je aanmelding is daarom niet doorgegaan. Onze excuses voor het ongemak. Met vriendelijke groet, Bond van Cannabis Detaillisten
- Na bevestigen: mail gaat naar de gast, aanmelding wordt verwijderd. Per aanmelding maximaal één keer.
- Er gaat niets automatisch; pas na jouw klik.

## Technische details
- Nieuwe mailsjablonen: `agenda-new-registration-admin` en `agenda-guest-declined` (bestaande verzendroute, idempotency key op registratie-id).
- Databasetrigger op insert van `agenda_registrations` en `agenda_guest_registrations` (board-seed-rijen uitgezonderd) die melding + push via bestaande send-push aanroept.
- Weigeren: server-side stap (admin/board check) die mail in de wachtrij zet en daarna de gastrij verwijdert.
- Outlook-koppeling en bevestigingspoort blijven ongewijzigd. Niets publiceren; tijdens bouwen geen echte mails versturen.
