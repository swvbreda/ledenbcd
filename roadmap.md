# Roadmap

## Open
- [ ] Financiële module: Informer als enige bron (canonieke tabellen, jaarsync, overrides, betaalkoppelingen, controlemodule)
- [x] Veldmapping verkoop-/inkoopfacturen 2026 gevalideerd (totals, status, ledger_id->rubriek, relation_id->naam) + tests
- [x] Readiness/reconciliatiestatus (ledgerReadiness) zichtbaar in Controle & sync
- [ ] Ponto alleen saldo/betaaldatum/koppeling; nergens in totalen
- [ ] Tests: idempotentie, geen dubbeltelling, statusfilters, splits, blijvende overrides
- [ ] 2026-sync draaien en werkelijke API-totalen versus dashboardwaarden rapporteren

## Klaar
- [x] Coffeeshopregister-sync gebruikt het beveiligde export-endpoint met de juiste sleutelheader en antwoordvelden; publieke tabeltoegang is niet meer nodig
- [x] Push-/koppelsleutels opnieuw ingevoerd (REGISTER_PUSH_SECRET, COFFEESHOPBELEID_API_SECRET, BCD_KOPPEL_SLEUTEL)
- [x] Certificaatfout `coffeeshopbeleid.nl` opgelost: basisadres instelbaar (standaard `.com`) + terugval bij netwerkfouten
- [x] Beleidsmonitor-sync (leden push/dossiers) werkt: 173 verstuurd, 174 dossiers
