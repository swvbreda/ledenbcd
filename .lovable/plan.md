# WhatsApp-updates automatisch in de ledenapp

## Waarom je koppelpogingen mislukten
WhatsApp laat geen enkele app meelezen in groepen of communities. Dat geldt voor Lovable en voor alle andere apps: de officiële koppeling ziet alleen berichten die rechtstreeks naar een zakelijk nummer gaan. Daarom komt een bericht dat je in de ledengroep zet nooit vanzelf in de app terecht, hoe je de koppeling ook instelt.

## Werkwijze die wél kan
1. De bond krijgt één eigen **WhatsApp Business-nummer** dat aan de app gekoppeld is. Dat mag een nieuw nummer zijn of een nummer dat al in de WhatsApp Business-app staat.
2. Je zet je update zoals altijd in de groep of community. Daarna **stuur je hem één keer door** naar het bondsnummer. Dat is een paar tikken.
3. Komt het bericht van een goedgekeurde afzender (jij, eventueel ook andere bestuursleden), dan verschijnt het **direct bij Aankondigingen** voor alle leden. Leden krijgen daarbij de gewone app-melding.
4. Berichten van andere afzenders worden nooit gepubliceerd. Die blijven alleen in de beveiligde WhatsApp-inbox voor het bestuur.
5. De afzender krijgt een korte bevestiging terug: "Geplaatst in de ledenapp".

## Wat je zelf moet doen
- In de koppelkaart die ik open, WhatsApp Business verbinden met het bondsnummer. Meta keurt dat goed; dat kan enkele minuten duren.
- Aangeven welke telefoonnummers mogen publiceren. Standaard is dat alleen jouw nummer.

## Technisch
- WhatsApp-connector koppelen (`standard_connectors--connect`, `whatsapp`) en dit project kiezen als ontvanger van inkomende berichten.
- Nieuwe ontvanger `src/routes/api/public/whatsapp/webhook.ts`, gecontroleerd met `verifyWebhookRequest` (`@lovable.dev/webhooks-js`, maxBodyBytes 4 MB). Elke levering wordt eerst opgeslagen in een nieuwe tabel `whatsapp_webhook_events` (delivery_id uniek, event, payload, processed_at, processing_error; RLS alleen bestuur/beheer). Daarna volgt een idempotente verwerking die 5xx teruggeeft zodat mislukte leveringen opnieuw worden geprobeerd.
- De bestaande inbox (`whatsapp_conversations`/`whatsapp_messages`, via `whatsapp_ingest_message`) wordt gevuld vanuit de nieuwe ontvanger. De oude Meta-route blijft bestaan maar krijgt geen nieuwe berichten meer.
- Een nieuwe instelling `whatsapp_publishers` (telefoonnummers, alleen door beheerders te beheren) bepaalt wie mag publiceren. Een bericht van een publisher wordt een `member_announcements`-rij met status gepubliceerd. De bestaande trigger `notify_members_on_published_announcement` verstuurt dan de melding. Per WhatsApp-bericht-id wordt maximaal één aankondiging aangemaakt.
- De bevestiging gaat als vrij tekstbericht via de gateway `/messages`. Dat mag, omdat de afzender net zelf een bericht stuurde.
- Beheer: een kleine lijst met toegestane publishers op de WhatsApp-inboxpagina.
- Tests: handtekening afwijzen, dubbele levering, publisher tegenover niet-publisher, en maximaal één aankondiging per bericht.
