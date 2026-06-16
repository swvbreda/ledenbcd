# WhatsApp-integratie verwijderen

Je hebt aangegeven dat de WhatsApp-koppeling te ingewikkeld is. Ik haal de hele integratie eruit zodat de app weer overzichtelijk is. Community-functionaliteit (deelnemerslijst, todo) blijft behouden, alleen de WhatsApp-stukken gaan weg.

## Wat ik verwijder

**Pagina-tabs in `CommunityPage.tsx`:**
- Tab "Matcher" (WhatsAppMatcher)
- Tab "Inbox" (WhatsAppInbox)
- Tab "Templates" (WhatsAppTemplates)
- Tab "Instellingen" (WhatsAppInstellingen) — bevat de setup-wizard

Overblijvend: **Deelnemerslijst** en **Te doen**.

**Frontend bestanden:**
- `src/components/WhatsAppMatcher.tsx`
- `src/components/WhatsAppInbox.tsx`
- `src/components/WhatsAppTemplates.tsx`
- `src/components/WhatsAppInstellingen.tsx`
- `src/components/WhatsAppSetupWizard.tsx`
- `src/hooks/useWhatsApp.ts`
- `src/hooks/useWhatsAppStatus.ts`

**Edge functions (Lovable Cloud):**
- `whatsapp-send`
- `whatsapp-webhook`
- `whatsapp-status`

**Secrets** (indien aanwezig):
- `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`

## Wat ik laat staan

- Telefoonnummers op leden (voor bellen/SMS)
- `CommunityDeelnemersLijst` en `CommunityTodoList` — die hangen niet vast aan de WhatsApp-API
- Eventuele bestaande database-tabellen `whatsapp_messages` / `whatsapp_conversations` — die laat ik staan zodat geen data verloren gaat. Als je ze ook weg wilt, zeg het dan, dan voeg ik een migratie toe.

## Wat je daarna hebt

Een Community-pagina met alleen de bruikbare onderdelen, geen Meta-setup meer, geen verwarrende tabs. Als je later een eenvoudiger alternatief wilt (wa.me link of e-mail), kunnen we dat los toevoegen.
