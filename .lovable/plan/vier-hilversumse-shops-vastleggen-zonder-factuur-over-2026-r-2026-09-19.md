# Vier Hilversumse shops vastleggen zonder factuur over 2026 — read-only diagnose

Onderstaande is puur inspectie. Er is niets gewijzigd en er is niets verstuurd.

## 1. Waar staan leden, aanmelding, goedkeuring en contributie

- **Leden/leads**: tabel `members_data` (`id`, `member_type` = `member` | `lead` | `old`, `data` jsonb met o.a.
  `naam, bedrijfsnaam, plaats, email, email2, factuurEmail, locaties[], contacten[], lidSinds`).
  Actieve leden = `member_type='member'` en `id < 10000` (10001+ is gearchiveerd).
- **Aanmeldformulier van de website**: `supabase/functions/receive-public-signup/index.ts` schrijft in
  `membership_requests`. Databasetrigger `auto_create_member_from_request` maakt daar **direct** een
  nieuw lid/lead van (nieuw nummer = hoogste + 1) en zet het e-mailadres meteen in
  `member_allowed_emails` (inlogtoegang) en `member_mailing_preferences`. Trigger
  `notify_on_membership_request` stuurt bij zo'n rij een melding per mail.
- **Handmatig toevoegen**: `src/components/NewMemberDialog.tsx` (optioneel vinkje welkomstmail),
  lead → lid via `src/components/ConvertLeadDialog.tsx` (+ `lead_conversions`).
- **Goedkeuringen**: `src/pages/GoedkeuringenPage.tsx` (aanmeldingen, profielwijzigingen, logo's).
- **Contributie/facturatie**: `member_contributions` (jaar, bedrag, betaald, factuurnummer),
  `contribution_invoices` (verstuurde facturen), `contribution_payments` (betalingen),
  `budget_year_settings.contribution_amount` (€3.000), `finance_todos` (taken/herinneringen).

## 2. Factuurtriggers — dit is het risico

1. **Bij elk nieuw lid** (`members_data` insert met `member_type='member'`) draait trigger
   `auto_prepare_invoice_new_member`: die roept meteen Informer aan
   (`informer-sync?action=prepare_invoices&member_id=…`). In `supabase/functions/informer-sync/index.ts`
   maakt `prepareInvoices()` een debiteur aan, maakt de factuur **en verstuurt die direct per e-mail**
   naar `factuurEmail`/`email`. Bedrag naar rato vanaf de aanmeldmaand.
2. **Nachtelijke taak 04:50** `informer-send-pending-invoices-daily` → finaliseert en mailt alsnog elke
   nog openstaande conceptfactuur van dit jaar.
3. **Trigger `auto_todo_new_member`** zet een interne taak "Factuur aanmaken voor nieuw lid #…".
4. **`generate-finance-todos`** maakt herinneringen: "geen factuur" en "contributie niet betaald"
   zolang er een `member_contributions`-rij met `paid=false` staat.
5. **Betaallink in het ledenportaal**: `src/components/ContributiePaymentCard.tsx` toont betaalknoppen
   zolang de contributie van het jaar niet als betaald geldt.

**Bestaande vrijstelling**: er is geen vrijstellingsveld in de app. Wel bestaat er een natuurlijke rem:
`prepareInvoices()` slaat een lid over zodra er voor dat jaar al een rij in `contribution_invoices`
staat, en de herinneringen slaan het lid over bij een betaalde contributieregel. Dat kunnen we als
vrijstelling gebruiken (één regel per lid, bedrag € 0, met duidelijke omschrijving), zonder codewijziging
en zonder Informer.

## 3. Veiligste kleinste plan (uit te voeren zodra je akkoord geeft)

1. De vier shops worden eerst vastgelegd als **lead**, niet als lid. Leads raken géén van de
   factuurtriggers: geen Informer, geen factuur, geen taak, geen mail.
   Vastgelegd: naam, plaats Hilversum, adres (Galaxy: Naarderstraat 47), notitie
   "Gezamenlijke aanmelding via Maarten van Eijden, aanvraagformulier nog te ontvangen;
   contributievrijstelling rest 2026, gewone contributie vanaf 2027."
2. **Geen e-mailadressen invullen** in hun gegevens en niets in `member_allowed_emails` of
   `member_mailing_preferences`. De contactadressen uit de correspondentie blijven alleen in de notitie
   staan, zonder toewijzing aan een persoon of shop.
3. Zodra de formulieren binnen zijn: per shop de lead bijwerken en omzetten naar lid,
   **maar eerst** voor dat lidnummer een vrijstellingsregel plaatsen voor 2026
   (`contribution_invoices` bedrag € 0 met kenmerk "VRIJSTELLING-2026" en een betaalde
   `member_contributions`-regel van € 0). Daarmee slaat de factuurmotor het lid over, ontstaat er geen
   betaallink en komt er geen herinnering. Vanaf 2027 loopt alles weer normaal.
4. **Duplicaatrisico**: als zij alsnog het webformulier invullen, maakt het systeem er automatisch een
   nieuwe lead van. Twee opties, jij kiest: (a) vragen het formulier niet in te dienen en de gegevens
   per mail aan te leveren, of (b) na binnenkomst de dubbele rij samenvoegen in Goedkeuringen.
   Zonder jouw keuze doen we hier niets aan.
5. De Kikker wordt niet vastgelegd; Rif (lid 106), Dutch Flowers en Andorra blijven ongewijzigd.

## 4. Wat al in de gegevens staat over de genoemde adressen

- `abdelhakbazzahi@hotmail.com` → lid **106 Koffie Rif Hilversum** (hoofdadres, factuuradres,
  contactpersoon Abdel; ook in inlogtoegang en mailinglijst).
- `jeroen@vanhamholding.com` en `dorine@vanhamholding.com` → lid **21 Hunters** (Amsterdam),
  contactpersonen Jeroen van Ham en Dorine Buchener; ook in inlogtoegang en mailinglijst.
- De overige adressen (encegi@gmail.com, flik@casema.nl, valat@upcmail.nl,
  hilversum.promenade@gmail.com, johangomes@live.nl, info@galaxyhilversum.nl, jeroenrlvld@gmail.com,
  pdfbauwens@outlook.com) komen **nergens** in de gegevens voor: niet bij een lid, niet in de
  inlogtoegang, niet in de mailinglijst, niet in de aanmeldingen.
- In Hilversum staan nu als lid: **97 Piramide** en **106 Koffie Rif**. De Professor, De Promenade,
  The Paradise en Galaxy staan nog niet in de ledengegevens. Dutch Flowers en Andorra staan niet als
  Hilversums lid geregistreerd — graag bevestigen onder welke naam/plaats zij bij jou bekend zijn.

## Openstaande vragen

- Akkoord om ze eerst als lead vast te leggen (geen mail, geen factuur), of wil je ze meteen als lid met
  vrijstellingsregel?
- Keuze bij punt 3.4 (webformulier wel/niet invullen).
