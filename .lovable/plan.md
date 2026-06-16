## Context
De gebruiker is bezig met het koppelen van de WhatsApp Cloud API, maar raakt verdwaald tussen Meta Business Suite, Business Manager en Meta for Developers. Er zijn nog geen WhatsApp-secrets geconfigureerd. De huidige WhatsApp Instellingen-tab toont alleen leden-voorkeuren, maar geen setup-status.

## Doel
Een self-service opstapwizard toevoegen bovenaan de WhatsApp Instellingen-tab, zodat de gebruiker exact ziet wat er ontbreekt, welke URL's in Meta geplakt moeten worden, en in welke volgorde.

## Wat we bouwen

### 1. WhatsAppSetupStatus component
- Een card bovenaan de tab die de 4 vereiste secrets checkt:
  - WHATSAPP_VERIFY_TOKEN
  - WHATSAPP_APP_SECRET
  - WHATSAPP_ACCESS_TOKEN
  - WHATSAPP_PHONE_NUMBER_ID
- Per secret: "Ontbreekt" / "Ingesteld" badge
- Totale status: "Niet gekoppeld", "Gedeeltelijk", "Klaar voor test"

### 2. Webhook URL tonen
- De publieke webhook-URL (Supabase functions/v1/whatsapp-webhook) wordt getoond in een kopieerbaar veld, zodat de gebruiker deze direct in Meta kan plakken.

### 3. Stap-voor-stap routekaart
Een genummerde lijst met exact wat waar gedaan moet worden:

```text
1. Meta Business Manager (business.facebook.com)
   - Business verificatie voltooien (KvK)
   - WhatsApp Business Account (WABA) aanmaken
   - Telefoonnummer toevoegen aan WABA

2. Meta for Developers (developers.facebook.com)
   - Nieuwe Business-app aanmaken
   - Product "WhatsApp" toevoegen
   - App Secret noteren

3. Webhook configureren (in de app zelf)
   - Callback URL: <supabase functions url>/v1/whatsapp-webhook
   - Verify token: kies zelf een willekeurige string (20+ tekens)

4. Meta for Developers → System User
   - System User aanmaken in Business Manager
   - Rechten: whatsapp_business_messaging + whatsapp_business_management
   - Token genereren en noteren

5. Secrets invullen in Lovable
   - Vul de 4 waarden in via Instellingen → Secrets
```

### 4. Secrets-invoer dialoog
- Een knop "Secrets invullen" opent een dialoog met 4 velden
- Bij opslaan: secrets worden via de secrets-tool toegevoegd
- Geen hardcoded secrets in code

### 5. Test-verbinding knop
- Alleen zichtbaar als alle 4 secrets aanwezig zijn
- Stuurt een test-bericht naar een eigen nummer (met telefoonnummer-invoer)
- Toont succes/fout terugkoppeling

## Technische details
- Nieuw component: `src/components/WhatsAppSetupWizard.tsx`
- Integreren in `WhatsAppInstellingen.tsx` bovenaan de pagina
- Backend: geen wijzigingen nodig; bestaande edge functions `whatsapp-webhook` en `whatsapp-send` werken al
- Geen nieuwe database-tabellen nodig

## Wat de gebruiker daarna zelf doet
De gebruiker doorloopt de routekaart in Meta, genereert de 4 secrets, en vult ze in via de dialoog in de app. Daarna test de verbinding.