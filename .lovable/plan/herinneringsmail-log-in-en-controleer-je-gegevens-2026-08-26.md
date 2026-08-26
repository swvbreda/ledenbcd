# Herinneringsmail: log in en controleer je gegevens

Doel: iedereen die eerder al een uitnodiging heeft gehad maar nog geen account heeft aangemaakt, krijgt één duidelijke herinneringsmail in de huisstijl van de website, met stap-voor-stap inloginstructies zodat je geen telefoontjes krijgt.

## Wat er komt

1. **Nieuwe e-mailtemplate "Herinnering: controleer je gegevens"**
   - Huisstijl: wit, rood accent (#A31621 / brand-rood), BCD-logo bovenaan, Archivo-achtige vette kop, Barlow-achtige leestekst met web-safe fallback.
   - Grote rode knop "Inloggen op het ledenportaal" naar https://leden.coffeeshopbond.nl.
   - Genummerde instructies:
     1. Ga naar leden.coffeeshopbond.nl
     2. Nog geen account? Klik op "Nog geen account? Registreren"
     3. Gebruik exact het e-mailadres waarop je deze mail ontvangt
     4. Kies zelf een wachtwoord (minimaal 8 tekens)
     5. Bevestig de beveiligingscode die je per e-mail krijgt (verplichte tweestapsverificatie)
     6. Controleer daarna je gegevens: contactpersoon, adres, locaties, factuurgegevens — wijzigingen dien je in ter goedkeuring
   - Blok "Lukt het niet?" met contactadres van het bestuur in plaats van bellen.
   - Persoonlijke aanhef met contactpersoon + coffeeshop.

2. **Nieuwe doelgroep in bulkverzending: "Eerder gemaild, nog geen account"**
   - Filtert op leden (member_type = 'member') zonder gekoppeld account, waarvan het e-mailadres al voorkomt in het verzendlog van eerdere uitnodigingen.
   - Bestaande optie "sla al eerder verzonden ontvangers over" blijft werken, maar wordt voor deze template op de herinnering zelf toegepast (dus niet dubbel herinneren).
   - Je ziet vooraf de lijst met ontvangers en kunt hem als CSV downloaden.

3. **Beheerscherm**
   - De template verschijnt op de pagina E-mailtemplates met onderwerp/tekst die je zelf kunt aanpassen, plus de bulkverzendknop met de nieuwe doelgroep als standaard.

## Technisch

- Nieuwe template `supabase/functions/_shared/transactional-email-templates/login-reminder.tsx` (React Email, logo via publieke URL, inline styles), geregistreerd in `registry.ts`; daarna `deploy_edge_functions`.
- `send-transactional-email` blijft de enige verzendfunctie; verzending per ontvanger met idempotency key.
- `src/components/BulkEmailSend.tsx`: nieuwe audience `previously_mailed_no_account`, het "al verzonden"-log wordt per templateName opgehaald in plaats van hardcoded `member-welcome`, en de gekozen template wordt naar de juiste `templateName` gestuurd.
- `src/pages/EmailTemplatesPage.tsx`: label/omschrijving en standaarddoelgroep voor de nieuwe sleutel `login_reminder`; databaserij in `email_templates` met onderwerp en tekst.
- Kleuren/typografie uit `src/index.css` overnemen; e-mailachtergrond blijft wit.
