# Registerstatus leesbaar tonen: vergund / aangevraagd / geweigerd

De ruwe statuswaarden uit het register worden nu letterlijk getoond ("actief", "in_behandeling", ...). Die tekst zegt weinig over de vergunningssituatie. We tonen voortaan één van drie duidelijke labels.

## Labels

| Registerwaarde | Label |
|---|---|
| actief, verleend, verlengd | Vergund |
| aangevraagd, in_behandeling | Aangevraagd |
| geweigerd, ingetrokken, verlopen | Geweigerd / vervallen |

Onbekende waarden vallen terug op de originele tekst met hoofdletter.

## Aanpak

- Nieuwe helper `statusLabel()` in `src/lib/registerActive.ts` (naast de bestaande actief-definitie), zodat elke pagina hetzelfde label gebruikt.
- Toepassen op:
  - locatiekaarten in ledenprofielen (`LocationRegisterInfo.tsx`)
  - detaildialoog van het register (`CoffeeshopRegisterDetailDialog.tsx`)
- Alleen weergave; de onderliggende data en filterlogica (vergund/alle) blijven ongewijzigd.
