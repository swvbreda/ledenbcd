# Pushmelding bij nieuwe declaratie voor Bernard en Simone

## Wat het onderzoek liet zien (alleen gelezen, niets gewijzigd)

**Declaratieflow vandaag**
- Indienen zet de status op "ingediend" en de Informer-status op "niet verzonden". Dat gebeurt in `src/hooks/useInternalDeclarations.ts` (`create`, `submitConcept`, `edit` met `submit`). Er gaat nog niets naar Informer.
- Goedkeuren (`approve`) mag alleen vanuit "ingediend" en is voorwaardelijk. Daarna roept de app `sendToInformer` aan. Afwijzen (`reject`) werkt hetzelfde, maar zonder Informer.
- Op dit moment gaat er bij indienen **geen melding of push** uit. Er is geen trigger en de code roept nergens `send-push` aan.

**Beveiliging goedkeuring (database)**
- Trigger `zy_guard_declaration_approval` → `guard_declaration_approval`: een nieuwe declaratie kan niet direct goedgekeurd zijn. Goedkeuren kan alleen vanuit "ingediend". De beoordelaar moet `is_declaration_approver` zijn en moet zelf de ingelogde gebruiker zijn.
- `is_declaration_approver` = admin **en** (Simones vaste account-id **of** `is_treasurer`). `is_treasurer` kijkt in `board_members` of de functie "penningmeester" bevat en of het e-mailadres exact overeenkomt.
- Op dit moment volstaat **één** goedkeuring. Er is geen tweede handtekening.

**Accounts**
- Simone van Breda: admin, haar account is de vaste goedkeurder, er zijn 2 telefoons geregistreerd voor push.
- Bernard van Nierop staat **twee keer** in het bestuur ("Bestuurder / Penningmeester"), en elke rij is aan een ander inlogaccount gekoppeld:
  - account A: admin, 1 telefoon geregistreerd → kan goedkeuren
  - account B: geen admin, 0 telefoons → kan niet goedkeuren
  - Met welk account Bernard echt werkt, is niet bewezen. Dat moet Simone bevestigen.

**Push**
- Er is alleen native iPhone-push: APNs via `supabase/functions/send-push` en `src/hooks/usePushNotifications.ts`, met de tabel `push_device_tokens`.
- `send-push` kan alleen naar groepen sturen (`admin`/`members`/iedereen), niet naar één bepaalde persoon. Een declaratiemelding zou dus bij alle admins aankomen.
- Er is **geen** webpush in de browser. Wie de app niet op de telefoon heeft, krijgt geen melding.
- Er bestaat al een veilig patroon voor push naar één persoon: de taakmeldingen. Een databasetrigger maakt de melding aan en een server-only dispatcher verstuurt die precies één keer, met een claim en een maximum aantal pogingen (`task_notifications`, `src/lib/taskPush.ts`, `taskNotifications.functions.ts`).

**Informer en idempotentie**
- `supabase/functions/informer-sync/declarationSync.ts` weigert alles wat niet "goedgekeurd" is. Verzonden rijen met een extern id slaat hij over, en hij claimt atomair (`sending`). Betaalde en verzonden rijen kun je niet meer bewerken.
- Huidige stand: 20 goedgekeurd/verzonden, 20 goedgekeurd/niet verzonden, 2 goedgekeurd/fout. Daar komt niets aan.
- Bonnen staan in de privé-opslag `declaration-receipts` (maximaal 10 MB, JPG/PNG/WebP/PDF) en worden nooit overschreven.

## Open vraag (wordt niet gekozen tot je antwoordt)
Is **één** goedkeuring van Bernard of Simone genoeg, zoals nu? Of moeten ze **allebei** goedkeuren voordat de declaratie naar Informer gaat?

## Wat ik ga bouwen (na je antwoord)
1. **Push naar precies Bernard en Simone** bij elke nieuwe ingediende declaratie, ook bij een concept dat later wordt ingediend. De melding toont alleen "Declaratie ter goedkeuring" en verwijst naar Financiën. Er staan geen bedragen of namen in.
   - Ik hergebruik het taakmeldingspatroon. Een trigger bij de overgang naar "ingediend" maakt één melding per goedkeurder, gekozen via `is_declaration_approver`. De server-only dispatcher verstuurt elke melding één keer. Als push mislukt, blijft het indienen gewoon werken.
2. **Alleen als beide vereist zijn:** een tweede-goedkeuringsstap. Er komt een aparte vastlegging per goedkeurder. De status wordt pas "goedgekeurd" als beide verschillende goedkeurders getekend hebben. De Informer-verzending start pas daarna. Bestaande goedgekeurde of verzonden declaraties blijven ongemoeid.
3. **Bernards dubbele account:** ik pas niets aan voordat jij bevestigt welk account hij gebruikt.

## Verificatie
- Tests: één melding per goedkeurder, geen dubbele melding bij nog eens opslaan, geen melding voor niet-goedkeurders, en bij mislukte push blijft de declaratie ingediend.
- Bij keuze "beide": één goedkeuring stuurt niets naar Informer, twee verschillende goedkeurders wel. Dezelfde persoon twee keer telt niet.
- Geïsoleerde databasetest van de trigger. Er gaat geen echte push uit totdat jij een testmoment afspreekt.

## Grenzen
Geen echte push of mails, geen goedkeuringen, exports of betalingen, geen wijziging aan de mailstoring en geen publicatie zonder jouw akkoord.
