# Welkomstmail met inloguitleg en WhatsApp-community

Nieuwe leden krijgen nu een korte welkomstmail zonder uitleg. Die wordt uitgebreid met duidelijke inlogstappen en de verwijzing naar de WhatsApp-community in het portaal.

## Wat er verandert

1. **Welkomstmail in huisstijl**
   - Rode balk met BCD-naam, vette kop, leestekst — zelfde stijl als de herinneringsmail.
   - Grote rode knop "Inloggen op het ledenportaal" naar leden.coffeeshopbond.nl.
   - Genummerd blok "Zo maak je je account aan":
     1. Ga naar leden.coffeeshopbond.nl
     2. Klik onderaan op "Nog geen account? Registreren"
     3. Gebruik exact het e-mailadres waarop je deze mail ontving
     4. Kies een wachtwoord van minimaal 8 tekens
     5. Bevestig de beveiligingscode per e-mail (tweestapsverificatie is verplicht)
     6. Controleer je gegevens: contactpersoon, adres, locaties en factuurgegevens
   - Nieuw blok "WhatsApp-community": zodra je bent ingelogd, vind je in het menu van het ledenportaal de link om deel te nemen aan de WhatsApp-community van de BCD. De uitnodigingslink staat bewust alleen achter de login, niet in de mail.
   - Afsluiting "Lukt het niet?" met info@coffeeshopbond.nl.

2. **Overal dezelfde mail**
   - Bestuur voegt een lid/lead toe (Nieuw lid-dialoog): welkomstmail met deze uitleg.
   - Iemand meldt zich zelf aan via de site: bevestigingsmail met dezelfde uitleg.
   - Voor leads blijft de tekst passend (kennismaking), maar de inlogstappen worden alleen getoond wanneer er echt een account kan worden aangemaakt.

3. **Beheer**
   - Onderwerp en de vrije tekst blijven aanpasbaar op de pagina E-mailtemplates; de stappen en knoppen zitten vast in de opmaak, zodat ze niet per ongeluk verdwijnen.

## Technisch

- Nieuwe template `supabase/functions/_shared/transactional-email-templates/member-welcome-steps.tsx` (React Email, inline styles, witte achtergrond), geregistreerd in `registry.ts`; daarna `deploy_edge_functions` van `send-transactional-email`.
- Props: `subject`, `body`, `showSteps` (leads uit), `portalUrl`.
- `src/components/NewMemberDialog.tsx` en `supabase/functions/notify-membership-request/index.ts` sturen `templateName: 'member-welcome-steps'` met `showSteps` op basis van lid/lead.
- Bestaande `member-welcome` blijft bestaan voor andere verzendingen (bulkmail) zodat er niets breekt.
- Databaserij `email_templates.member_welcome` krijgt een kortere inleidende tekst, omdat de instructies nu in de opmaak zitten.
