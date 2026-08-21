# Uitgaven-administratie opschonen en controleren

## Wat ik in de data heb gevonden

- Er zijn **drie bronnen** die dezelfde betalingen bevatten: de oude PDF-bankimport (`mutov586262741_01012026-01062026.pdf`, 198 regels), de live bankkoppeling (Ponto, 275 regels) en de boekingen uit Informer/handmatig (219 regels).
- **Alle 198 regels van de oude bankimport komen ook voor in de live bankkoppeling** (zelfde bedrag, datum binnen 3 dagen). Die import telt dus overal dubbel mee.
- Van de Informer-/handmatige boekingen zijn er **106 die ook als bankbetaling bestaan** (64 van 65 handmatige, 24 van 29 uit de PDF-import, 18 van 117 uit de losse import).
- **141 uitgaande bankbetalingen hebben nog geen dossier.**
- Er zijn 26 factuurkoppelingen op 15 unieke bestanden; 4 daarvan hangen alleen aan een dossier en niet aan een betaling.

Kort: het dubbeltellen komt vooral door de oude bankimport en de handmatige/PDF-boekingen die naast de bankregels blijven staan.

## Wat ik ga doen

### 1. Eén waarheid per betaling
De live bankkoppeling wordt de bron voor alle geldstromen. De oude PDF-bankimport wordt buiten alle overzichten gehouden (dossiers, begroting, dashboard). De gegevens blijven bewaard, maar tellen niet meer mee.

Handmatige en PDF-geïmporteerde boekingen die aantoonbaar dezelfde betaling zijn als een bankregel (zelfde bedrag, datum binnen 10 dagen, zelfde tegenpartij) worden aan die bankregel gekoppeld en als één regel getoond in plaats van twee.

### 2. Alle betalingen nalopen
Een eenmalige, gecontroleerde doorloop van alle uitgaande betalingen van 2026:
- dossier bepalen via factuurnummer in de omschrijving, daarna via herkenningsregels op tegenpartij;
- facturen (uit Informer en de handmatige uploads) aan de juiste betaling hangen op declaratie-/factuurnummer, ook als één betaling meerdere facturen bundelt;
- wat niet automatisch te bepalen is, blijft staan als openstaand controlepunt in plaats van dat er iets wordt gegokt.

### 3. Controlescherm in Financiën
Nieuw tabblad **Controle uitgaven** met vier lijsten, zodat je zelf ziet dat het klopt:
- betalingen zonder dossier (nu 141);
- betalingen zonder factuur;
- facturen zonder betaling;
- vermoedelijke dubbelingen tussen bronnen, met een knop "samenvoegen" of "geen dubbele".

Per regel kun je direct het dossier toewijzen of de factuur koppelen.

### 4. Dossieroverzicht klopt weer
Totaal per dossier telt elke betaling nog maar één keer en toont per regel of er een factuur bij zit. Contributie-dossiers blijven verborgen zoals nu.

## Technisch

- Nieuw helperbestand `src/lib/ledgerDedupe.ts`: één ontdubbelfunctie (bedrag + datumvenster + genormaliseerde tegenpartij) die zowel `useBudget.ts` als `useDossiers.ts` gebruiken, zodat begroting en dossiers dezelfde uitkomst geven.
- `useDossiers.ts`: bron `bank_transactions` (oude import) wordt niet meer geladen; `budget_expenses` met een gematchte Ponto-tegenhanger worden als `sources[]` van de bankregel meegenomen in plaats van als losse regel.
- Eenmalige data-opschoning via migratie/SQL: dossier invullen op `ponto_transactions` waar leeg en eenduidig af te leiden; extra rijen in `expense_documents` met `entry_key = 'ponto:<id>'` voor facturen die nu alleen aan `expense:<id>` of `dossier:<naam>` hangen.
- Nieuw component `src/components/budget/ControleUitgavenTab.tsx` + tab in `FinancienPage.tsx`, gevoed door de bestaande hooks; acties hergebruiken `useDossierMutationActions.setDossier` en `useExpenseDocumentActions.relink`.
- Geen schemawijziging nodig.
