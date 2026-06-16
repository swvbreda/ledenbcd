
# Plan: WhatsApp Business koppelen (officiële Meta Cloud API)

## Wat dit wel/niet doet
**Wel:**
- Notificaties sturen naar leden (factuur klaar, herinnering contributie, nieuwsbrief-achtige updates op individueel niveau, jubileum, etc.) via goedgekeurde templates.
- Inkomende WhatsApp-berichten van leden ontvangen en in het portaal beantwoorden (een eenvoudige inbox/chat-view).
- Per lid bijhouden of we mogen WhatsAppen + opt-out respecteren.

**Niet (Meta-beperking, geen workaround):**
- Community-groepen beheren / deelnemers toevoegen of verwijderen — die endpoints bestaan simpelweg niet. Dat blijft gaan via de huidige **Matcher** en **Te doen** tabs.

## Wat jij eerst regelt bij Meta (eenmalig, ~30–60 min)
Ik kan dit niet voor je doen — Meta vereist persoonlijke verificatie. Pas als deze 4 dingen klaar zijn kan ik de koppeling activeren:

1. **Meta Business Manager** account aanmaken op business.facebook.com.
2. **WhatsApp Business Account (WABA)** toevoegen + bedrijf verifiëren (KvK-uittreksel uploaden — duurt 1–3 dagen review).
3. **Telefoonnummer registreren** (het aparte nummer dat je hebt). LET OP: zodra geregistreerd kun je het niet meer in de gewone WhatsApp app gebruiken.
4. **App aanmaken** in developers.facebook.com → product "WhatsApp" toevoegen → genereer:
   - `WHATSAPP_ACCESS_TOKEN` (permanent System User token, niet de 24-uurs test-token)
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_BUSINESS_ACCOUNT_ID`
   - `WHATSAPP_VERIFY_TOKEN` (vrij te kiezen string voor webhook-verificatie)
   - `WHATSAPP_APP_SECRET` (voor signature-verificatie)

Ik geef je een korte checklist met screenshots-instructies als we starten.

## Wat ik bouw in het portaal

### Backend (Supabase)
- **Tabel `whatsapp_messages`**: alle in/uitgaande berichten met `member_id`, `phone`, `direction`, `body`, `template_name`, `status` (queued/sent/delivered/read/failed), `wa_message_id`, `timestamp`, `error`.
- **Tabel `whatsapp_templates`**: registreert welke templates we bij Meta hebben ingediend + goedkeuringsstatus + variabelen.
- **Tabel `whatsapp_preferences`**: per lid opt-in/opt-out, vergelijkbaar met `member_mailing_preferences`.
- **Tabel `whatsapp_conversations`**: laatste contactmoment per lid (voor 24-uurs venster regel — buiten dat venster mag alleen een template).
- RLS: alleen admin/bestuur lezen, alleen edge functions schrijven (service role).

### Edge functions
- **`whatsapp-webhook`** (`verify_jwt = false`): ontvangt Meta webhooks — GET voor verificatie, POST voor inkomende berichten + delivery statuses. Verifieert `X-Hub-Signature-256` met app secret. Mapt nummer → `member_id` via `member_edits.contacten[].phone` en `whatsapp_participants.phone`.
- **`whatsapp-send`**: stuurt bericht via Meta Graph API. Kiest automatisch tussen vrije tekst (binnen 24u na inkomend bericht) of template. Logt in `whatsapp_messages`.
- **`whatsapp-sync-templates`**: haalt huidige template-status op bij Meta en synct naar `whatsapp_templates`.

### Frontend — uitbreiding `/community`
Nieuwe sub-tabs naast Deelnemerslijst / Matcher / Te doen:
- **Inbox**: lijst conversaties (laatste bericht + ongelezen badge), klik = chat-view met lid. Knop "stuur template" als 24u-venster verlopen is.
- **Templates**: overzicht van templates + status (approved/pending/rejected) + knop "verstuur naar selectie leden".
- **Instellingen**: opt-in beheer per lid, blokkeerlijst.

Op `/leden/:id` MemberDetail: extra blok met WhatsApp-historie + "stuur bericht" knop (alleen zichtbaar voor admin/bestuur).

### Notificatie-koppelingen (later, na basis werkt)
Naar analogie met `notify-edit-request` / `notify-membership-request` edge functions:
- Factuur klaar → WhatsApp notificatie (template).
- Edit-request goedgekeurd → notificatie.
- Contributie-herinnering.

## Secrets die ik via `add_secret` vraag (pas nadat je de Meta-setup klaar hebt)
`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`.

## Volgorde van uitvoering
1. Database-migratie voor de 4 tabellen + RLS + grants.
2. Edge function `whatsapp-webhook` + URL geef ik je om in Meta Developer Console te plakken.
3. Edge function `whatsapp-send`.
4. UI Inbox + Templates + Instellingen in `/community`.
5. WhatsApp-blok op MemberDetail.
6. Pas in een vervolg-iteratie: 1–2 templates registreren bij Meta en koppelen aan bestaande events.

## Kosten (Meta, niet Lovable)
Vanaf 1 juli 2025 rekent Meta per bericht (€0,01–€0,08 afhankelijk van categorie/land). Service-conversaties geïnitieerd door het lid binnen 24u zijn gratis. Voor jullie volume verwacht ik <€10/maand.

## Wat NIET in dit plan zit
- Group/community deelnemerssync (kan niet via Meta — blijft Matcher-flow).
- Bulk-marketing campagnes (mag niet via WhatsApp regels).
- Migratie van het huidige community-nummer (apart nummer wordt gebruikt).
