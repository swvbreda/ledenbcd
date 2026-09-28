# Roadmap

## Open
- [ ] Vereenvoudigde ledentoegang met persoonlijke bevestigings-/inloglinks; veilig koppelen en geïsoleerd testen; niet publiceren.
- [x] Deel-previews: goedgekeurd en verwerkt in preview; nog niet publiceren.
- [ ] Financiële module: Informer als enige bron (canonieke tabellen, jaarsync, overrides, betaalkoppelingen, controlemodule)
- [x] Veldmapping verkoop-/inkoopfacturen 2026 gevalideerd (totals, status, ledger_id->rubriek, relation_id->naam) + tests
- [x] Readiness/reconciliatiestatus (ledgerReadiness) zichtbaar in Controle & sync
- [x] Ponto alleen saldo/betaaldatum/koppeling; begroting, resultaat en dossiers lezen de canonieke boekhoudregels
- [x] Tests: 13 tests (idempotentie, geen dubbeltelling, statusfilters, splits, readiness, overrides)
- [x] 2026-sync gedraaid; verschillen met het boekhouddashboard zichtbaar als "niet volledig gereconcilieerd"
- [ ] Contributiestatus uit de boekhouding: API levert maar 9 verkoopfacturen 2026, rest ontbreekt (uitzonderingenlijst)

## Klaar
- [x] Coffeeshopregister-sync gebruikt het beveiligde export-endpoint met de juiste sleutelheader en antwoordvelden; publieke tabeltoegang is niet meer nodig
- [x] Push-/koppelsleutels opnieuw ingevoerd (REGISTER_PUSH_SECRET, COFFEESHOPBELEID_API_SECRET, BCD_KOPPEL_SLEUTEL)
- [x] Certificaatfout `coffeeshopbeleid.nl` opgelost: basisadres instelbaar (standaard `.com`) + terugval bij netwerkfouten
- [x] Beleidsmonitor-sync (leden push/dossiers) werkt: 173 verstuurd, 174 dossiers

## Ledentoegang met persoonlijke link (geblokkeerd voor livegang)
- [x] Voorbereide inlog-, bevestigings- en aanvraagcode achter standaard uitgeschakelde schakelaars; bestaande toegang blijft actief.
- [ ] Auth-mailtemplate/redirects veilig configureren, RLS-migratie toetsen en toepassen, geïsoleerde positieve Auth + mailopvang + sessie + eigen-dossier-ketentest uitvoeren. Blokkade: geen afgeschermde Auth-/mailomgeving of goedkeuring om productieconfiguratie te wijzigen.
- [ ] Welkomstmail met één persoonlijke knop veilig aansluiten zonder tweede mail; blokkade: Auth-mailafhandeling moet eerst positief bevestigd zijn.
- [ ] Afzonderlijk: alle evenementdeelnemers mailen; buiten deze toegangstaak.
