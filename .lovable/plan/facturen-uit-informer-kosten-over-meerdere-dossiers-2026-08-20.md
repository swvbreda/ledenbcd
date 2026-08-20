# Facturen uit Informer + kosten over meerdere dossiers

## Stand van zaken
De laatste Informer-run (vandaag 04:31, stap crediteuren) verliep zonder fouten, maar er staan nul factuurbestanden opgeslagen. De code probeert wel drie PDF-adressen per inkoopfactuur, maar er wordt nergens vastgelegd wat Informer daarop antwoordt — dus we weten nu niet of Informer de PDF's simpelweg niet levert of dat er een ander adres nodig is.

## 1. Uitzoeken waarom er geen facturen binnenkomen
- De ophaalstap gaat per inkoopfactuur bijhouden wat er gebeurt: welk adres is geprobeerd, welke statuscode kwam terug, en waarom een bestand is overgeslagen.
- Die uitkomst komt in het synclogboek en wordt zichtbaar in het tabblad Informer, zodat je in één oogopslag ziet: "10 facturen bekeken, 0 PDF's beschikbaar (404 op alle adressen)" of juist een concrete fout.
- We proberen daarnaast een paar extra plekken waar Informer bijlagen kan aanbieden (bijlagenlijst per factuur, en een los bijlage-adres), en gebruiken het bestandstype dat Informer teruggeeft in plaats van altijd PDF aan te nemen.
- Levert Informer echt niets, dan zegt het scherm dat expliciet en blijft handmatig uploaden de weg — geen stille nullen meer.
- Knop "Facturen ophalen" in het Informer-tabblad om deze stap los te draaien zonder de hele sync.

## 2. Kosten verdelen over meerdere dossiers
- In het boekingsvenster komt een sectie "Dossierverdeling": je voegt regels toe met per regel een dossier en een bedrag. Onbeperkt aantal dossiers per boeking.
- Boven de regels staat het totaalbedrag van de boeking en wat er nog te verdelen is; opslaan kan pas als de som klopt met het totaal.
- Een boeking zonder verdeling blijft werken zoals nu (één dossier).
- In het dossieroverzicht telt alleen het toegewezen deel mee in het totaal van dat dossier. In het dossierdetail zie je bij zo'n regel het deelbedrag plus een label dat het een gedeelde kost is, met de andere dossiers erbij.
- Facturen die aan een gedeelde boeking hangen, zijn in álle betrokken dossiers zichtbaar.

## Technische aanpak
- Nieuwe tabel `expense_dossier_splits` (`entry_key`, `dossier`, `amount`, `year`, aangemaakt door) met RLS en GRANTs zoals bij `expense_documents`; `entry_key` volgt hetzelfde `kind:id`-formaat, dus splitsing werkt voor handmatige boekingen, bankregels én Ponto-transacties.
- `useDossiers.ts`: mutaties krijgen een `splits`-veld; de dossiergroepering gebruikt splits wanneer aanwezig en valt anders terug op het bestaande `dossier`-veld. Bestaande dossierlogica in `useBudget.ts` blijft ongewijzigd, behalve dat de dossierfilter ook splits meeneemt.
- `ExpenseDialog.tsx` krijgt de verdeelsectie; validatie op som = totaalbedrag (afronding op centen).
- `informer-sync/index.ts`: `fetchPurchaseInvoicePdf` geeft een diagnose-object terug in plaats van `null`; per factuur verzameld in `details` van `informer_sync_log`, plus extra kandidaat-endpoints en content-type-detectie. `InformerSyncTab.tsx` toont de samenvatting en krijgt de losse actieknop.
