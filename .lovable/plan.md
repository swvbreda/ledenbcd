# "Verkeerd betaald" weer selecteerbaar maken

## Wat er aan de hand is
In het koppelvenster ("Openen") bestaat de keuze *Verkeerde rekening — buiten begroting* nog steeds. In de **dossier-dropdown in de lijst zelf** (kolom "Dossier", zie screenshot) ontbreekt die keuze: die lijst wordt opgebouwd uit dossiers die al in de database voorkomen. Zodra er geen boeking meer op dat dossier staat, verdwijnt de optie uit de lijst.

## Oplossing
- De optie **"Buiten begroting (verkeerde rekening)"** wordt een vaste keuze in de dossier-dropdown van de bankboekingenlijst, bovenaan gescheiden van de gewone dossiers, ongeacht of er al boekingen op staan.
- Selecteren zet het dossier direct op de boeking; de regel telt dan (zoals nu) niet mee in begroting, dashboard en dossieroverzichten.
- Dezelfde vaste optie wordt toegevoegd aan andere plekken waar een dossier gekozen wordt (koppelvenster en detailvenster), zodat het gedrag overal gelijk is.

## Technisch
- `src/components/budget/BankboekingenTab.tsx`: `dossierList` aanvullen met `EXCLUDED_DOSSIER` uit `src/lib/budgetExclusions.ts`; in de `<select>` als aparte `optgroup`/eerste optie tonen en dubbele vermelding voorkomen.
- Controleren dat `isExcludedDossier` de regel als "afgehandeld" blijft zien, zodat hij uit de lijst "nog te categoriseren" verdwijnt.
- Geen databasewijzigingen nodig.
