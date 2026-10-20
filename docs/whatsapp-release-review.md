# WhatsApp → Aankondigingen: review en release

## Gedrag
- Standaard lege allowlist; uitsluitend admins beheren expliciete internationale publishers in WhatsApp-inbox. Toestemmende admin wordt server-side vastgelegd en moet bij ontvangst nog admin zijn.
- Alleen `messages[]` op het geverifieerde BCD-ontvangernummer, type `text`, met een echte boolean `context.forwarded` of `context.frequently_forwarded` publiceert. Deze metadata bewijst doorgestuurd, niet de community van herkomst: die kan niet worden uitgelezen.
- Titel is maximaal 160 tekens van de eerste niet-lege oorspronkelijke regel, geen gegenereerde titel. Volledige oorspronkelijke tekst (max. 5.000 tekens), regeleinden en links blijven in de body; links worden niet uit de tekst verwijderd. Bestaande ledenpagina `/aankondigingen` toont dit als gewone gepubliceerde aankondiging.
- Bijlagen/captions, gewone DM's, verkeerde/onbekende ontvanger en niet-toegestane afzenders blijven in de bestaande afgeschermde inbox; admin ziet de publicatiebeslissing. Echo/history/contact/status-events publiceren nooit.
- Deduplicatie geldt per WhatsApp-message-id, niet per delivery; connector en legacy delen één transactionele controle. Beslissingen worden niet heroverwogen na toestemming of verwijderen van een aankondiging. Geen automatische WhatsApp-verzending/antwoord.
- Bestaande aankondigingsrechten en bestaande notificatietrigger blijven intact. Daardoor kan een echte toegestane publicatie de bestaande ledennotificatie activeren; tests doen dit nooit.

## Reviewbare wijzigingen
- `drizzle/migrations/0048_whatsapp_forwarded_announcements.sql`: lege publisherlijst, admin-only leesrechten, admin-checkende beheers-RPC, gedeelde service-only publicatiefuncties, private unieke beslissingen, transactionele aansluiting op connectorverwerking, behoud oorspronkelijke body.
- `src/lib/whatsappPublishers*`, `src/components/WhatsAppPublishers.tsx`: expliciet beheer, internationale normalisatie, serverauth + directe admincheck.
- `src/pages/WhatsAppInboxPage.tsx`, `src/hooks/useWhatsAppInbox.ts`: beheer en begrijpelijke status zonder privé-inbox naar leden te ontsluiten.
- `src/routes/api/public/whatsapp-webhook.ts`, `src/lib/whatsappWebhook.ts`: legacy behoudt eigen signatureverificatie en gebruikt dezelfde atomaire ingest/publicatie. Connectorroute blijft onveranderd.
- Unit/render-tests plus SQL rollback- en concurrentieproeven onder `supabase/tests/whatsapp_announcements*`.

## Checks
- 33 unit-tests voor handtekeningen, malformed payload/opslagfouten, ontvangst, nummernormalisatie en uitsluitend echte inkomende berichten.
- 3 beheerrendertests: non-admin laadt/beheert niets; lege lijst geeft niemand toestemming; alleen expliciet ingediend nummer wordt naar de server verstuurd.
- PostgreSQL-proeven op een afzonderlijke lokale fixture met de actuele verwerkingsfuncties: toegestane forwarded tekst → precies 1, replay connector/legacy → 1, gewone/nietallowed/bijlage/echo → 0, behoud originele body, service-only grants/admin-RLS, anoniem beheer geweigerd, geforceerde transactiefout → geen half bericht/beslissing. Rollback en vooraf geïsoleerde notifier.
- 12 gelijktijdige aanroepen in diezelfde aparte database → 1 beslissing en 1 aankondiging. Geen echte publisher, aankondiging, notificatie of rol toegevoegd.
- Productiedatabase-proef kon notificatietrigger niet veilig isoleren wegens ontbrekende eigendomsrechten; daarom geen publicatieproef op gedeelde database uitgevoerd.
- Preview met bestaande ingelogde gebruiker: beheerblok en standaard lege lijst zichtbaar, niets opgeslagen. Automatische build OK.

## Niet publiceren met normale Update
Normale publicatie is geen selectie per bestand: de huidige volledige codeversie gaat mee. Daarin zitten aantoonbaar:
- Persoonlijke ledentoegang: `src/lib/memberLogin.functions.ts`, `src/pages/LoginPage.tsx`, `src/pages/MemberConfirmPage.tsx`, `src/routes/member-confirm.tsx` (o.a. commits `9de239ce`, `f642bda4`, `b2b6b478`, `d1c724d7`). De functie vereist zowel de browser- als serverschakelaar; code gaat ook mee als die uitstaan. Mailtemplate/positieve Auth-ketentest blijven volgens roadmap geblokkeerd.
- Deel-previews: `src/lib/socialHead.ts`, aangepaste pagina-heads en afbeeldingen in `public/social/` (o.a. `c0a2d230`, `612bd2db`).
- Agenda "Mail alle deelnemers" staat ook expliciet als nog niet gepubliceerd in roadmap; huidige Agenda-code gaat eveneens mee.
Het precieze delta ten opzichte van de laatst gepubliceerde commit is niet vast te stellen zonder die release-identificatie; bovenstaande aanwezigheid in huidige code is wel gecontroleerd. De gedeelde databasewijziging is al toegepast, zonder seeds: publishers/beslissingen zijn leeg en dus deny-by-default.

## Alleen WhatsApp veilig releasen
Niet deze volledige preview publiceren en niet terugzetten/resetten. Bewaar alle huidige werk op de bestaande ontwikkelbranch. Laat een aparte releasebranch/werkdirectory beginnen bij de **exact laatst gepubliceerde commit** en neem alleen de WhatsApp-ontvangerwijzigingen van de eerdere reeks tot `58f95daf` en bovenstaande WhatsApp-bestanden/afhankelijkheden over. Niet `58f95daf` als releasebasis gebruiken: diens voorgeschiedenis bevat de uitgesloten wijzigingen.
Controleer de bestandsdiff, dependency-lockfile en routegeneratie op die releasebranch; laat de gedeelde database op zijn bestaande additieve schema. Test daar signature/ontvangst/adminrechten opnieuw. Publiceer uitsluitend de gecontroleerde releaseversie via een afzonderlijke releaseomgeving/branchworkflow; wijzig of overschrijf de bestaande ontwikkelbranch niet. De beschikbare chattools bieden geen selectieve bestandspublicatie. De laatst gepubliceerde commit en gekozen releaseworkflow zijn nog nodig voordat deze route uitvoerbaar kan worden bevestigd.

## Open
1. Gebruiker geeft het echte publishernummer; alleen via expliciete adminactie toestaan, nooit afleiden.
2. Selectieve releasebasis/workflow vastleggen en beoordelen, daarna pas publicatie autoriseren.
3. Na die release één echte, toegestane forwarded tekst controleren tot opgeslagen aankondiging in ledenweergave; dit is nu bewust niet gedaan wegens notifytrigger en ontbrekende publisher.