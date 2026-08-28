# Registerwijzigingen automatisch doorvoeren + handmatig bijwerken per lid

Doel: zodra het coffeeshopregister in "Coffeeshopbeleid" wijzigt, wordt dat automatisch doorgevoerd in het ledenbestand. Daarnaast kun je zelf een bijwerkronde starten voor één lid of één vestiging.

## 1. Automatische push vanuit Coffeeshopbeleid

- Nieuw ontvangstpunt in dit project: `register-changed`. Het accepteert een melding met een gedeeld geheim, start de registersync en direct daarna de ledenaanvulling.
- Meldingen worden samengevoegd: komen er binnen een minuut meerdere wijzigingen binnen (bijv. een bulkimport), dan draait er één ronde in plaats van tientallen.
- In het project **Coffeeshopbeleid** komt een databasetrigger op de vergunningentabel die bij elke toevoeging, wijziging of intrekking een melding stuurt naar dit ontvangstpunt.
- Het gedeelde geheim wordt in beide projecten opgeslagen; ik vraag het aan wanneer we gaan bouwen.
- De bestaande dagelijkse sync blijft als vangnet staan voor het geval een melding verloren gaat.

## 2. Handmatig bijwerken voor één lid of vestiging

- Knop **"Bijwerken vanuit register"** op de leden-detailpagina (hele lid) en per vestigingskaart (alleen die vestiging).
- Alleen bestuur/beheer ziet deze knop. Na afloop verschijnt een melding met wat er is aangevuld en hoeveel voorstellen er klaarstaan.
- De aanvulling volgt dezelfde regels als nu: lege velden worden gevuld, afwijkingen worden voorstellen, factuurgegevens worden nooit overschreven.

## 3. Wat je ziet

- Adreswijzigingen (verhuizingen) verschijnen kort na de registerwijziging vanzelf als voorstel, zonder dat je iets hoeft te starten.
- Op de registerpagina blijft zichtbaar wanneer de laatste ronde liep en wat de aanleiding was (dagelijks, push of handmatig).

## Technisch

- Nieuwe edge function `register-changed` (`verify_jwt = false`), authenticatie via header `x-register-push-secret` tegen secret `REGISTER_PUSH_SECRET`. Debounce via een rij in `coffeeshop_register_sync_state` (`last_push_at`); binnen 60 seconden wordt de melding genegeerd.
- `enrich-members-from-register` accepteert een JSON-body `{ member_id?, register_id? }` en filtert de bevestigde koppelingen daarop; zonder body blijft het gedrag ongewijzigd.
- Nieuwe RPC `trigger_register_enrichment_scoped(_member_id int, _register_id uuid)` (security definer, admin/bestuur) die de function met die body aanroept via `net.http_post` met het interne webhook-secret.
- Frontend: `useRunEnrichment` krijgt een scoped-variant in `src/hooks/useCoffeeshopRegister.ts`; knoppen in `MemberDetail.tsx` en `LocationRegisterInfo.tsx`.
- In Coffeeshopbeleid: trigger op `coffeeshop_vergunningen` (AFTER INSERT/UPDATE/DELETE, statement-level) die `net.http_post` doet naar het ontvangstpunt. Dat vergt een wijziging in dat project; ik lever de migratie daar aan zodra dit plan akkoord is.
