
## Doel

Leden kunnen de jaarcontributie van €3.000 zelf online betalen via Stripe — **ineens** of in **2 termijnen** — naast de bestaande mogelijkheid van handmatige overschrijving. Zodra Stripe een betaling bevestigt, wordt de contributie automatisch op "betaald" gezet in de administratie.

## Verwachte kosten

Per geslaagde betaling via Stripe (NL):
- **iDEAL:** ~1,4% + €0,25 → ~€42 bij €3.000 ineens, ~€21 per termijn bij 2× €1.500
- **Creditcard EU:** ~1,5% + €0,25
- Geen vaste maandkosten. Geen Lovable-extra's; gewone Stripe-tarieven.

Voor ~30 leden die ineens betalen: ~€1.260 transactiekosten per jaar. Bij 2 termijnen verdubbelt dat naar ~€2.520.

## Wat we bouwen

### 1. Stripe inschakelen
- Lovable's ingebouwde Stripe-integratie activeren (geen eigen Stripe-account nodig om te starten; testomgeving werkt direct, live na verificatie).
- Tax handling: **uit** (contributie is een vrijgestelde verenigingsbijdrage, geen btw nodig).

### 2. Producten in Stripe
- Eén product "Jaarcontributie BCD" met twee prijzen:
  - €3.000 ineens
  - €1.500 (gebruikt voor termijn 1 én termijn 2)

### 3. Betaalpagina voor het lid
- Nieuwe pagina **"Contributie betalen"** binnen het ledenportaal (zichtbaar op `MijnAccountPage` of `ContributiePage`).
- Toont: openstaande contributie voor het lopende jaar + drie knoppen:
  - **Betaal €3.000 ineens** (iDEAL/creditcard)
  - **Betaal in 2 termijnen** (eerste €1.500 nu, herinnering voor tweede over 6 maanden)
  - **Ik maak het zelf over** (huidige flow, geen Stripe)
- Knop opent Stripe Checkout in een nieuw tabblad.

### 4. Automatische verwerking na betaling
- Webhook van Stripe → Edge Function `stripe-webhook` die:
  - lid identificeert (via `metadata.member_id` op de Checkout sessie)
  - contributie van dat jaar in `contributions` tabel op `betaald` zet
  - bij 2-termijnen-flow: registreert dat termijn 1 of 2 is voldaan; pas bij beide → volledig betaald
  - boeking aanmaakt in de financiële administratie zodat het overzicht klopt
- Resultaat: bestuur hoeft niets meer handmatig in te boeken voor Stripe-betalingen.

### 5. Herinnering tweede termijn
- 6 maanden na termijn 1: lid krijgt automatisch een e-mail met betaallink voor termijn 2.
- Zichtbaar in bestuurspagina: welke leden in welke termijn-status zitten.

### 6. Bestuur overzicht
- In de financiële module nieuwe sectie **"Online betalingen (Stripe)"** met overzicht van: lid, bedrag, datum, status (geslaagd/openstaand termijn 2/mislukt), Stripe-transactiekosten.

## Wat we niet doen
- Geen maandelijkse incasso (12×) — viel buiten je keuze.
- Geen SEPA automatische incasso (zou bij maandelijks de goedkoopste zijn, maar je koos voor 1× of 2×).
- Geen verplichting; handmatige overschrijving blijft naast Stripe bestaan.

## Volgorde van uitvoering
1. Stripe inschakelen via Lovable (jij vult in het formulier je gegevens in).
2. Producten + prijzen aanmaken in Stripe via Lovable tool.
3. Edge function `stripe-webhook` + database velden voor `payment_status`, `stripe_session_id`, `installment_number` toevoegen aan `contributions`.
4. Betaalpagina + knoppen bouwen op `ContributiePage`/`MijnAccountPage`.
5. Bestuursoverzicht + e-mailherinnering termijn 2.
6. Eerst testen in Stripe testmodus met fake iDEAL, daarna live zetten.

## Technische details
- Stripe Checkout Session in `payment` mode (geen subscription — past niet bij "2 keer").
- Tweede termijn = nieuwe Checkout Session, niet automatisch afgeschreven (lid moet zelf klikken op herinnering). Echt automatisch incasseren vereist SEPA mandaat — bewust niet gekozen.
- Webhook signature verificatie via `STRIPE_WEBHOOK_SECRET`.
- Idempotency: `member_id + jaar + termijn` voorkomt dubbele boekingen bij retries.
