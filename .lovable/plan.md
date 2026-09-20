# Diagnose: pushbericht komt niet aan (sent: 0)

## Wat de log zegt

De laatste poging van `send-push` gaf van Apple:

```text
APNs status 403 — reason: BadEnvironmentKeyInToken
```

Daarom telt `sent: 0` bij `total: 1`: het bericht is wel verstuurd naar Apple, maar Apple weigert het.

## Oorzaak

Het apparaat dat zich heeft aangemeld, is een **testbuild** (ontwikkelomgeving). Zo'n apparaatcode hoort bij Apple's testserver. De functie stuurt echter altijd naar Apple's **productieserver** (`api.push.apple.com`); er is geen testvariant (`api.sandbox.push.apple.com`) in de code. Apple antwoordt dan precies met `BadEnvironmentKeyInToken`.

In het iOS-project staat inderdaad: Debug-build = `development`, Release-build = `production`. Een via Xcode/TestFlight-debug geïnstalleerde app levert dus een testcode op.

Het is dus geen fout in de sleutels of de app-identificatie.

## Controle instellingen (geen waarden getoond)

- `APNS_KEY_ID` — aanwezig
- `APNS_TEAM_ID` — aanwezig
- `APNS_PRIVATE_KEY` — aanwezig
- `APNS_BUNDLE_ID` — niet ingesteld; de code valt terug op `nl.coffeeshopbond.leden`, wat overeenkomt met de app-identificatie in het iOS-project. Consistent, geen probleem.

Let op: als de sleutel of het team wél fout waren, zou Apple `InvalidProviderToken` of `TopicDisallowed` geven, niet deze melding.

## Mogelijke oplossing (nog niet uitgevoerd)

Bij het opslaan van een apparaatcode ook vastleggen of het om een test- of productie-app gaat, en bij verzending de bijbehorende Apple-server kiezen. Alternatief zonder codewijziging: alleen testen met een App Store-/TestFlight-release-build.

Zeg welke richting je wilt, dan werk ik het uit.
